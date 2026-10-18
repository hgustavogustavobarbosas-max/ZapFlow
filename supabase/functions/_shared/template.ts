// Substituição de variáveis {nome} em templates de mensagem.
// Só variáveis explicitamente fornecidas são substituídas; as demais permanecem como estão.

export const MAX_VARIAVEL_LENGTH = 200;

function sanitizar(valor: string): string {
  // Remove caracteres de controle (exceto quebra de linha) e limita o tamanho.
  // deno-lint-ignore no-control-regex
  return valor.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").slice(0, MAX_VARIAVEL_LENGTH);
}

export function renderTemplate(template: string, variaveis: Record<string, string>): string {
  return template.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (original, chave: string) => {
    const nome = chave.toLowerCase();
    return Object.hasOwn(variaveis, nome) ? sanitizar(variaveis[nome]) : original;
  });
}
