import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "./phone.ts";

const ok = (v: unknown) => {
  const r = normalizePhone(v);
  return r.ok ? r.phone : null;
};

test("normaliza formatos brasileiros comuns", () => {
  assert.equal(ok("5511999999999"), "5511999999999");
  assert.equal(ok("+55 (11) 99999-9999"), "5511999999999");
  assert.equal(ok("(11) 99999-9999"), "5511999999999");
  assert.equal(ok("1133334444"), "551133334444");
  assert.equal(ok("0055 11 99999 9999"), "5511999999999");
  assert.equal(ok(11999999999), "5511999999999");
});

test("aceita números internacionais plausíveis", () => {
  assert.equal(ok("+351 912 345 678"), "351912345678");
});

test("rejeita números inválidos", () => {
  for (const v of ["", "abc", "123", "00000000000", "11111111111", "5501999999999", "55119999999999", null, undefined, {}]) {
    assert.equal(ok(v), null, `deveria rejeitar ${JSON.stringify(v)}`);
  }
  assert.equal(ok("551188887777666"), null);
});

test("rejeita celular brasileiro sem o nono dígito 9", () => {
  assert.equal(ok("55118999999999"), null);
});
