// Inicia o checkout da assinatura na AbacatePay. O frontend recebe apenas a URL de pagamento.
// POST (sem corpo)
import { criarCheckoutAssinatura } from "../_shared/abacatepay.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { optionalEnv, requireEnv } from "../_shared/env.ts";
import { erro, HttpError, json, respostaDeExcecao } from "../_shared/http.ts";
import { consumirRateLimit, createAdminClient, requireUser } from "../_shared/supabase.ts";

async function tratar(req: Request): Promise<Response> {
  if (req.method !== "POST") return erro(405, "metodo_nao_permitido", "Use POST", { Allow: "POST" });

  const user = await requireUser(req);
  const admin = createAdminClient();
  if (!(await consumirRateLimit(admin, `checkout-user:${user.id}`, 5, 60))) {
    return erro(429, "limite_excedido", "Muitas tentativas. Aguarde um instante.");
  }

  const produtoId = requireEnv("ABACATEPAY_PRODUCT_ID", "abacatepay_nao_configurada", "Produto de assinatura não configurado no servidor.");
  const appUrl = requireEnv("APP_URL", "app_url_ausente", "APP_URL não configurada no servidor.").replace(/\/+$/, "");
  const plano = optionalEnv("ABACATEPAY_PLAN_NAME") ?? "ZapFlow Pro";

  const { data: atual, error: erroConsulta } = await admin
    .from("assinaturas")
    .select("status_assinatura")
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (erroConsulta) throw new Error(`consulta de assinatura: ${erroConsulta.message}`);
  if (atual?.status_assinatura === "active" || atual?.status_assinatura === "inadimplente") {
    throw new HttpError(409, "assinatura_ativa", "Você já possui uma assinatura em andamento.");
  }

  const checkout = await criarCheckoutAssinatura({
    produtoId,
    externalId: user.id,
    usuarioId: user.id,
    completionUrl: `${appUrl}/dashboard/faturamento?checkout=ok`,
    returnUrl: `${appUrl}/dashboard/faturamento`,
  });

  // Registra o checkout para que o webhook consiga relacionar o pagamento a este usuário.
  const { error: erroGravacao } = await admin.from("assinaturas").upsert(
    {
      usuario_id: user.id,
      status_assinatura: "pendente",
      plano,
      abacatepay_checkout_id: checkout.id,
    },
    { onConflict: "usuario_id" },
  );
  if (erroGravacao) throw new Error(`gravação do checkout: ${erroGravacao.message}`);

  return json({ url: checkout.url });
}

Deno.serve(async (req) => {
  const resposta = preflight(req);
  if (resposta) return resposta;
  let resultado: Response;
  try {
    resultado = await tratar(req);
  } catch (err) {
    resultado = respostaDeExcecao(err, "abacatepay-checkout");
  }
  for (const [k, v] of Object.entries(corsHeaders(req))) resultado.headers.set(k, v);
  return resultado;
});
