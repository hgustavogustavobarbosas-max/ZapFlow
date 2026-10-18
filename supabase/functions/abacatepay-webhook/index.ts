// Webhook da AbacatePay (API v2). Cadastre a URL com ?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>.
// Autenticidade: (1) secret na query string e (2) assinatura HMAC-SHA256 (base64) do corpo bruto
// no header X-Webhook-Signature, calculada com a chave pública HMAC da AbacatePay.
import { parseEventoAssinatura } from "../_shared/abacatepay.ts";
import { hmacSha256Base64, timingSafeEqual } from "../_shared/crypto.ts";
import { requireEnv } from "../_shared/env.ts";
import { erro, HttpError, json, readBodyLimited, respostaDeExcecao } from "../_shared/http.ts";
import { proximaRenovacao } from "../_shared/renovacao.ts";
import { type Admin, consumirRateLimit, createAdminClient } from "../_shared/supabase.ts";
import { clientIp } from "../_shared/http.ts";

const MAX_BODY_BYTES = 256 * 1024;

type Alteracao = {
  status_assinatura: string;
  abacatepay_subscription_id?: string;
  abacatepay_customer_id?: string;
  proxima_renovacao?: string | null;
};

async function localizarAssinatura(
  admin: Admin,
  filtro: { coluna: "abacatepay_checkout_id" | "abacatepay_subscription_id"; valor?: string },
): Promise<string | null> {
  if (!filtro.valor) return null;
  const { data, error } = await admin.from("assinaturas").select("usuario_id").eq(filtro.coluna, filtro.valor).maybeSingle();
  if (error) throw new Error(`consulta de assinatura: ${error.message}`);
  return data?.usuario_id ?? null;
}

async function tratar(req: Request): Promise<Response> {
  if (req.method !== "POST") return erro(405, "metodo_nao_permitido", "Use POST", { Allow: "POST" });

  const admin = createAdminClient();
  if (!(await consumirRateLimit(admin, `pay-ip:${clientIp(req)}`, 300, 60))) {
    return erro(429, "limite_excedido", "Muitas requisições");
  }

  const segredoEsperado = requireEnv("ABACATEPAY_WEBHOOK_SECRET");
  const chaveHmac = requireEnv("ABACATEPAY_PUBLIC_KEY");

  const segredoRecebido = new URL(req.url).searchParams.get("webhookSecret") ?? "";
  if (!timingSafeEqual(segredoRecebido, segredoEsperado)) {
    throw new HttpError(401, "nao_autorizado", "Não autorizado");
  }

  const corpo = await readBodyLimited(req, MAX_BODY_BYTES);
  const assinaturaRecebida = req.headers.get("x-webhook-signature") ?? "";
  const assinaturaEsperada = await hmacSha256Base64(chaveHmac, corpo);
  if (!timingSafeEqual(assinaturaRecebida, assinaturaEsperada)) {
    throw new HttpError(401, "assinatura_invalida", "Assinatura inválida");
  }

  let evento;
  try {
    evento = parseEventoAssinatura(JSON.parse(corpo));
  } catch {
    evento = null;
  }
  if (!evento) throw new HttpError(400, "evento_invalido", "Evento inválido");

  // Idempotência: a AbacatePay reenvia eventos quando não recebe 2xx.
  const { data: jaProcessado } = await admin.from("eventos_pagamento").select("id").eq("id", evento.id).maybeSingle();
  if (jaProcessado) return json({ ok: true, duplicado: true });

  const { subscription, customer, checkout, payment } = evento.data;
  let usuarioId: string | null = null;
  let alteracao: Alteracao | null = null;

  switch (evento.event) {
    case "subscription.completed":
      usuarioId =
        (await localizarAssinatura(admin, { coluna: "abacatepay_checkout_id", valor: checkout?.id })) ??
        (await localizarAssinatura(admin, { coluna: "abacatepay_subscription_id", valor: subscription?.id }));
      alteracao = {
        status_assinatura: "active",
        abacatepay_subscription_id: subscription?.id,
        abacatepay_customer_id: customer?.id,
        proxima_renovacao: proximaRenovacao(subscription?.frequency),
      };
      break;
    case "subscription.renewed":
      usuarioId = await localizarAssinatura(admin, { coluna: "abacatepay_subscription_id", valor: subscription?.id });
      alteracao = { status_assinatura: "active", proxima_renovacao: proximaRenovacao(subscription?.frequency) };
      break;
    case "subscription.payment_failed":
      usuarioId = await localizarAssinatura(admin, { coluna: "abacatepay_subscription_id", valor: subscription?.id });
      alteracao = { status_assinatura: "inadimplente" };
      break;
    case "subscription.cancelled":
      usuarioId = await localizarAssinatura(admin, { coluna: "abacatepay_subscription_id", valor: subscription?.id });
      alteracao = { status_assinatura: "cancelada", proxima_renovacao: null };
      break;
    default:
      // Eventos que não alteram o estado da assinatura (ex.: checkout.*, payout.*).
      break;
  }

  if (alteracao) {
    if (!usuarioId) {
      // Sem correspondência não há o que atualizar; responder 2xx evita retentativas inúteis.
      console.warn(JSON.stringify({
        contexto: "abacatepay-webhook",
        aviso: "assinatura_nao_encontrada",
        evento: evento.event,
        subscription: subscription?.id ?? null,
        checkout: checkout?.id ?? payment?.externalId ?? null,
      }));
    } else {
      const campos = Object.fromEntries(Object.entries(alteracao).filter(([, v]) => v !== undefined));
      const { error } = await admin.from("assinaturas").update(campos).eq("usuario_id", usuarioId);
      if (error) throw new Error(`atualização de assinatura: ${error.message}`);
    }
  }

  await admin.from("eventos_pagamento").upsert({ id: evento.id, evento: evento.event }, { onConflict: "id", ignoreDuplicates: true });
  return json({ ok: true });
}

Deno.serve(async (req) => {
  try {
    return await tratar(req);
  } catch (err) {
    return respostaDeExcecao(err, "abacatepay-webhook");
  }
});
