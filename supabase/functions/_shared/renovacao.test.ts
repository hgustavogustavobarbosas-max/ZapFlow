import { test } from "node:test";
import assert from "node:assert/strict";
import { proximaRenovacao } from "./renovacao.ts";

const base = new Date("2026-01-31T12:00:00.000Z");

test("calcula renovação por frequência", () => {
  assert.equal(proximaRenovacao("WEEKLY", base), "2026-02-07T12:00:00.000Z");
  assert.equal(proximaRenovacao("ANNUALLY", base), "2027-01-31T12:00:00.000Z");
  assert.equal(proximaRenovacao("QUARTERLY", new Date("2026-01-15T00:00:00.000Z")), "2026-04-15T00:00:00.000Z");
});

test("usa mensal como padrão", () => {
  assert.equal(proximaRenovacao(undefined, new Date("2026-03-10T00:00:00.000Z")), "2026-04-10T00:00:00.000Z");
});
