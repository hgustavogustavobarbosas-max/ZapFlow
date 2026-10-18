// Respostas HTTP padronizadas e leitura segura do corpo da requisição.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    message: string,
  ) {
    super(message);
  }
}

const SECURITY_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, ...extraHeaders },
  });
}

export function erro(status: number, codigo: string, mensagem: string, extraHeaders: HeadersInit = {}) {
  return json({ erro: mensagem, codigo }, status, extraHeaders);
}

/** Lê o corpo como texto recusando requisições maiores que o limite (sem confiar só no Content-Length). */
export async function readBodyLimited(req: Request, maxBytes: number): Promise<string> {
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > maxBytes) throw new HttpError(413, "payload_grande", "Payload excede o tamanho máximo");

  if (!req.body) return "";
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let texto = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "payload_grande", "Payload excede o tamanho máximo");
    }
    texto += decoder.decode(value, { stream: true });
  }
  return texto + decoder.decode();
}

export function clientIp(req: Request): string {
  const encaminhado = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "";
  return encaminhado.split(",")[0].trim().slice(0, 64) || "desconhecido";
}

/** Converte exceções em respostas sem expor stack trace ou detalhes internos. */
export function respostaDeExcecao(err: unknown, contexto: string): Response {
  if (err instanceof HttpError) return erro(err.status, err.codigo, err.message);
  console.error(JSON.stringify({ contexto, erro: err instanceof Error ? err.message : String(err) }));
  return erro(500, "erro_interno", "Erro interno. Tente novamente em instantes.");
}
