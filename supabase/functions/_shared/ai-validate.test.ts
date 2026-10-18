import { test } from "node:test";
import assert from "node:assert/strict";
import { validarMensagemIA } from "./ai-validate.ts";

test("aceita mensagem válida e remove aspas externas", () => {
  assert.deepEqual(validarMensagemIA('"Olá *Ana*!"'), { ok: true, mensagem: "Olá *Ana*!" });
  assert.deepEqual(validarMensagemIA("  Oi, tudo bem?  "), { ok: true, mensagem: "Oi, tudo bem?" });
});

test("rejeita resposta vazia, inválida, longa ou com preâmbulo", () => {
  assert.equal(validarMensagemIA("   ").ok, false);
  assert.equal(validarMensagemIA('""').ok, false);
  assert.equal(validarMensagemIA(undefined).ok, false);
  assert.equal(validarMensagemIA("x".repeat(1600)).ok, false);
  assert.equal(validarMensagemIA("Aqui está a mensagem: Olá!").ok, false);
});
