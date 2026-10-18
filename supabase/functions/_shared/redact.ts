// Minimização de dados antes de persistir o payload recebido nos logs.

const CHAVE_SENSIVEL =
  /(senha|password|passwd|token|secret|segredo|api[-_]?key|apikey|authorization|bearer|cvv|cartao|card[-_]?number)/i;
const MAX_STRING = 1000;
const MAX_DEPTH = 10;

export function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncado]";
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactPayload(item, depth + 1));
  if (value !== null && typeof value === "object") {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(value as Record<string, unknown>)) {
      saida[chave] = CHAVE_SENSIVEL.test(chave) ? "[removido]" : redactPayload(v, depth + 1);
    }
    return saida;
  }
  return value;
}
