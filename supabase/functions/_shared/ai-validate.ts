// Validação da resposta da IA: nunca enviar mensagem vazia, longa demais ou com cara de preâmbulo.

export const MAX_MENSAGEM_IA = 1500;

export type MensagemIA = { ok: true; mensagem: string } | { ok: false; motivo: string };

const PREAMBULO = /^(aqui (est[áa]|vai)|claro[,!]|com certeza|segue (a )?mensagem|mensagem:)/i;

export function validarMensagemIA(bruta: unknown): MensagemIA {
  if (typeof bruta !== "string") return { ok: false, motivo: "Resposta da IA em formato inválido" };
  let texto = bruta.trim();
  // Remove aspas externas simétricas, que o prompt já proíbe.
  const pares: Array<[string, string]> = [['"', '"'], ["“", "”"], ["'", "'"]];
  for (const [abre, fecha] of pares) {
    if (texto.length > 1 && texto.startsWith(abre) && texto.endsWith(fecha)) {
      texto = texto.slice(1, -1).trim();
      break;
    }
  }
  if (texto === "") return { ok: false, motivo: "A IA retornou uma resposta vazia" };
  if (texto.length > MAX_MENSAGEM_IA) return { ok: false, motivo: "A IA retornou uma mensagem longa demais" };
  if (PREAMBULO.test(texto)) return { ok: false, motivo: "A IA retornou um preâmbulo em vez da mensagem" };
  return { ok: true, mensagem: texto };
}
