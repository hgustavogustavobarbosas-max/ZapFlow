import { test } from "node:test";
import assert from "node:assert/strict";
import { getByPath, isPlainObjectWithinDepth, listLeafPaths, toScalarString } from "./json-path.ts";

const payload = {
  cliente: { nome: "João", tags: ["a", "b"] },
  contato: { telefone: "5511999999999" },
  "Nome Completo": "Ana",
};

test("acessa propriedades aninhadas", () => {
  assert.equal(getByPath(payload, "cliente.nome"), "João");
  assert.equal(getByPath(payload, "contato.telefone"), "5511999999999");
});

test("suporta chaves com espaço e índices de array", () => {
  assert.equal(getByPath(payload, "Nome Completo"), "Ana");
  assert.equal(getByPath(payload, "cliente.tags.1"), "b");
});

test("retorna undefined para caminhos inexistentes ou inválidos", () => {
  assert.equal(getByPath(payload, "cliente.sobrenome"), undefined);
  assert.equal(getByPath(payload, "cliente..nome"), undefined);
  assert.equal(getByPath(payload, ""), undefined);
  assert.equal(getByPath(payload, "cliente.nome.x"), undefined);
});

test("bloqueia prototype pollution e propriedades herdadas", () => {
  assert.equal(getByPath(payload, "__proto__"), undefined);
  assert.equal(getByPath(payload, "cliente.constructor"), undefined);
  assert.equal(getByPath(payload, "toString"), undefined);
  assert.equal(getByPath(JSON.parse('{"__proto__":{"x":1}}'), "__proto__.x"), undefined);
});

test("limita tamanho e profundidade do caminho", () => {
  assert.equal(getByPath(payload, "a".repeat(201)), undefined);
  assert.equal(getByPath(payload, Array(11).fill("a").join(".")), undefined);
});

test("toScalarString aceita apenas texto e números", () => {
  assert.equal(toScalarString("  Ana "), "Ana");
  assert.equal(toScalarString(5511), "5511");
  assert.equal(toScalarString({}), null);
  assert.equal(toScalarString("   "), null);
  assert.equal(toScalarString(null), null);
});

test("lista caminhos folha", () => {
  assert.deepEqual(listLeafPaths({ a: { b: 1, c: 2 }, d: 3 }), ["a.b", "a.c", "d"]);
});

test("valida payload como objeto simples com profundidade limitada", () => {
  assert.equal(isPlainObjectWithinDepth({ a: 1 }), true);
  assert.equal(isPlainObjectWithinDepth([1]), false);
  assert.equal(isPlainObjectWithinDepth("x"), false);
  let fundo: Record<string, unknown> = {};
  const raiz = fundo;
  for (let i = 0; i < 20; i++) {
    const proximo: Record<string, unknown> = {};
    fundo.a = proximo;
    fundo = proximo;
  }
  assert.equal(isPlainObjectWithinDepth(raiz), false);
});
