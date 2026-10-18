import type { EnvioDia } from "../types/envios.ts";

type LogResumido = { criado_em: string; status: "sucesso" | "erro" };

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Chave AAAA-MM-DD no fuso local (o histórico é lido pelo usuário no horário dele). */
export function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

/** Início (00:00 local) do primeiro dia da janela de `quantidade` dias que termina hoje. */
export function inicioDaJanela(quantidade: number, hoje = new Date()): Date {
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (quantidade - 1));
}

/** Conta envios por dia, do mais antigo ao mais recente, incluindo dias sem envio. */
export function agruparPorDia(logs: ReadonlyArray<LogResumido>, quantidade: number, hoje = new Date()): EnvioDia[] {
  const inicio = inicioDaJanela(quantidade, hoje);
  const dias = new Map<string, EnvioDia>();
  for (let i = 0; i < quantidade; i++) {
    const data = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const dia = chaveDoDia(data);
    dias.set(dia, { dia, sucesso: 0, erro: 0 });
  }
  for (const log of logs) {
    const entrada = dias.get(chaveDoDia(new Date(log.criado_em)));
    if (entrada) entrada[log.status] += 1;
  }
  return [...dias.values()];
}

export function maiorContagemDiaria(dias: ReadonlyArray<EnvioDia>): number {
  return dias.reduce((maior, d) => Math.max(maior, d.sucesso, d.erro), 0);
}

export function totaisDoPeriodo(dias: ReadonlyArray<EnvioDia>): { sucesso: number; erro: number } {
  return dias.reduce((t, d) => ({ sucesso: t.sucesso + d.sucesso, erro: t.erro + d.erro }), { sucesso: 0, erro: 0 });
}

/** "2026-10-08" → "08/10". */
export function formatarDiaCurto(chave: string): string {
  const [, mes, dia] = chave.split("-");
  return `${dia}/${mes}`;
}
