// Leitura centralizada de variáveis de ambiente do servidor.
import { HttpError } from "./http.ts";

export function optionalEnv(nome: string): string | undefined {
  const valor = Deno.env.get(nome)?.trim();
  return valor ? valor : undefined;
}

export function requireEnv(nome: string, codigo = "configuracao_ausente", mensagem?: string): string {
  const valor = optionalEnv(nome);
  if (!valor) {
    console.error(JSON.stringify({ contexto: "env", ausente: nome }));
    throw new HttpError(503, codigo, mensagem ?? `Configuração do servidor ausente: ${nome}`);
  }
  return valor;
}
