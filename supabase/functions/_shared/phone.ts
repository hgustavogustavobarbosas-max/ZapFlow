// Validação e normalização de telefones para envio via WhatsApp.
// Números sem DDI (10 ou 11 dígitos) são tratados como brasileiros (+55).

export type PhoneResult = { ok: true; phone: string } | { ok: false; reason: string };

export function normalizePhone(input: unknown): PhoneResult {
  if (typeof input !== "string" && typeof input !== "number") {
    return { ok: false, reason: "Telefone ausente ou em formato inválido" };
  }
  let digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 0) return { ok: false, reason: "Telefone sem dígitos" };
  if (/^(\d)\1+$/.test(digits)) return { ok: false, reason: "Telefone inválido" };

  // Brasil sem DDI: DDD + número (fixo com 10 dígitos, celular com 11)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;

  if (digits.length < 12 || digits.length > 15) {
    return { ok: false, reason: "Telefone com quantidade de dígitos inválida" };
  }

  if (digits.startsWith("55")) {
    if (digits.length !== 12 && digits.length !== 13) {
      return { ok: false, reason: "Telefone brasileiro com quantidade de dígitos inválida" };
    }
    if (!/^[1-9][1-9]$/.test(digits.slice(2, 4))) {
      return { ok: false, reason: "DDD brasileiro inválido" };
    }
    if (digits.length === 13 && digits[4] !== "9") {
      return { ok: false, reason: "Celular brasileiro deve começar com 9 após o DDD" };
    }
  }
  return { ok: true, phone: digits };
}
