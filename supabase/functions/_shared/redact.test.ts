import { test } from "node:test";
import assert from "node:assert/strict";
import { redactPayload } from "./redact.ts";

test("remove chaves sensíveis em qualquer nível", () => {
  const saida = redactPayload({ nome: "Ana", senha: "x", dados: { apiKey: "k", token_acesso: "t", ok: 1 } });
  assert.deepEqual(saida, { nome: "Ana", senha: "[removido]", dados: { apiKey: "[removido]", token_acesso: "[removido]", ok: 1 } });
});

test("trunca strings longas e preserva arrays", () => {
  const saida = redactPayload({ a: "x".repeat(1500), b: [{ password: "p" }] }) as { a: string; b: unknown[] };
  assert.equal(saida.a.length, 1001);
  assert.deepEqual(saida.b, [{ password: "[removido]" }]);
});
