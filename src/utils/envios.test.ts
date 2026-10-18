import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorDia, chaveDoDia, formatarDiaCurto, inicioDaJanela, maiorContagemDiaria, totaisDoPeriodo } from "./envios.ts";

const hoje = new Date(2026, 9, 8, 15, 30); // 08/10/2026 15:30 local

const em = (dia: number, hora: number, status: "sucesso" | "erro") => ({
  criado_em: new Date(2026, 9, dia, hora, 0).toISOString(),
  status,
});

test("gera a janela completa, inclusive dias sem envio", () => {
  const dias = agruparPorDia([], 7, hoje);
  assert.equal(dias.length, 7);
  assert.equal(dias[0].dia, "2026-10-02");
  assert.equal(dias[6].dia, "2026-10-08");
  assert.ok(dias.every((d) => d.sucesso === 0 && d.erro === 0));
});

test("conta sucessos e erros no dia correto", () => {
  const dias = agruparPorDia([em(8, 9, "sucesso"), em(8, 23, "sucesso"), em(8, 0, "erro"), em(6, 12, "sucesso")], 7, hoje);
  assert.deepEqual(dias[6], { dia: "2026-10-08", sucesso: 2, erro: 1 });
  assert.deepEqual(dias[4], { dia: "2026-10-06", sucesso: 1, erro: 0 });
});

test("ignora registros fora da janela", () => {
  const dias = agruparPorDia([em(1, 10, "sucesso")], 7, hoje);
  assert.equal(totaisDoPeriodo(dias).sucesso, 0);
});

test("atravessa a virada de mês", () => {
  const dias = agruparPorDia([], 10, new Date(2026, 9, 3));
  assert.equal(dias[0].dia, "2026-09-24");
  assert.equal(chaveDoDia(inicioDaJanela(10, new Date(2026, 9, 3))), "2026-09-24");
});

test("calcula máximo e totais", () => {
  const dias = agruparPorDia([em(8, 9, "sucesso"), em(8, 10, "sucesso"), em(7, 10, "erro")], 7, hoje);
  assert.equal(maiorContagemDiaria(dias), 2);
  assert.deepEqual(totaisDoPeriodo(dias), { sucesso: 2, erro: 1 });
  assert.equal(maiorContagemDiaria([]), 0);
});

test("formata dia curto", () => {
  assert.equal(formatarDiaCurto("2026-10-08"), "08/10");
});
