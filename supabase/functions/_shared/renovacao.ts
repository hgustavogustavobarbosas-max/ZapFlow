// Cálculo da próxima renovação de assinatura.

/** Próxima renovação estimada a partir da frequência do plano (a API não envia a data). */
export function proximaRenovacao(frequencia: string | undefined, base = new Date()): string {
  const data = new Date(base);
  switch (frequencia) {
    case "WEEKLY":
      data.setUTCDate(data.getUTCDate() + 7);
      break;
    case "QUARTERLY":
      data.setUTCMonth(data.getUTCMonth() + 3);
      break;
    case "SEMIANNUALLY":
      data.setUTCMonth(data.getUTCMonth() + 6);
      break;
    case "ANNUALLY":
      data.setUTCFullYear(data.getUTCFullYear() + 1);
      break;
    default:
      data.setUTCMonth(data.getUTCMonth() + 1);
  }
  return data.toISOString();
}
