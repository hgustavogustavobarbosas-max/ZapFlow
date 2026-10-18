// Cliente mínimo da AbacatePay API v2 (checkout de assinatura) e tipos do webhook.
import { optionalEnv, requireEnv } from "./env.ts";
import { HttpError } from "./http.ts";

const TIMEOUT_MS = 15_000;

function baseUrl(): string {
  return (optionalEnv("ABACATEPAY_API_URL") ?? "https://api.abacatepay.com/v2").replace(/\/+$/, "");
}

export type CheckoutAssinatura = { id: string; url: string };

export async function criarCheckoutAssinatura(params: {
  produtoId: string;
  externalId: string;
  usuarioId: string;
  completionUrl: string;
  returnUrl: string;
}): Promise<CheckoutAssinatura> {
  const apiKey = requireEnv("ABACATEPAY_API_KEY", "abacatepay_nao_configurada", "Pagamentos não configurados no servidor.");
  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl()}/subscriptions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        items: [{ id: params.produtoId, quantity: 1 }],
        methods: ["CARD"],
        externalId: params.externalId,
        completionUrl: params.completionUrl,
        returnUrl: params.returnUrl,
        metadata: { usuario_id: params.usuarioId },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, "abacatepay_indisponivel", "Não foi possível contatar o provedor de pagamento.");
  }

  const corpo = await resposta.json().catch(() => null) as
    | { data?: { id?: unknown; url?: unknown }; error?: unknown }
    | null;
  if (!resposta.ok || !corpo?.data) {
    console.error(JSON.stringify({ contexto: "abacatepay_checkout", status: resposta.status, erro: String(corpo?.error ?? "") }));
    throw new HttpError(502, "abacatepay_recusou", "O provedor de pagamento recusou a criação do checkout.");
  }
  const { id, url } = corpo.data;
  if (typeof id !== "string" || typeof url !== "string") {
    throw new HttpError(502, "abacatepay_resposta_invalida", "Resposta inesperada do provedor de pagamento.");
  }
  return { id, url };
}

// ---- Webhook (API v2): apenas os campos que usamos ----

export type EventoAssinatura = {
  id: string;
  event: string;
  data: {
    subscription?: { id?: string; status?: string; frequency?: string };
    customer?: { id?: string };
    checkout?: { id?: string; externalId?: string | null };
    payment?: { externalId?: string | null };
  };
};

export function parseEventoAssinatura(bruto: unknown): EventoAssinatura | null {
  if (bruto === null || typeof bruto !== "object") return null;
  const e = bruto as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.event !== "string") return null;
  if (e.data === null || typeof e.data !== "object") return null;
  return e as unknown as EventoAssinatura;
}
