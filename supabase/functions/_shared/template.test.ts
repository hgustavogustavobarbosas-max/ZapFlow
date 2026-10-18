import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate } from "./template.ts";

test("substitui variáveis conhecidas", () => {
  assert.equal(
    renderTemplate("Olá {nome}, tudo bem? Seu número: {telefone}", { nome: "João", telefone: "5511999999999" }),
    "Olá João, tudo bem? Seu número: 5511999999999",
  );
});

test("mantém variáveis desconhecidas intactas", () => {
  assert.equal(renderTemplate("Oi {nome} {empresa}", { nome: "Ana" }), "Oi Ana {empresa}");
});

test("não interpreta valores como template nem acessa o protótipo", () => {
  assert.equal(renderTemplate("{nome}", { nome: "{telefone}", telefone: "1" }), "{telefone}");
  assert.equal(renderTemplate("{constructor} {toString}", {}), "{constructor} {toString}");
});

test("remove caracteres de controle e limita o tamanho", () => {
  assert.equal(renderTemplate("{nome}", { nome: "A\u0000B\u0007C" }), "ABC");
  assert.equal(renderTemplate("{nome}", { nome: "x".repeat(500) }).length, 200);
});

test("é case-insensitive nas chaves", () => {
  assert.equal(renderTemplate("{NOME}", { nome: "Ana" }), "Ana");
});
