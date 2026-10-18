import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { hmacSha256Base64, sha256Hex, timingSafeEqual } from "./crypto.ts";

test("HMAC-SHA256 em base64 confere com a implementação do Node", async () => {
  const corpo = '{"event":"subscription.completed"}';
  const esperado = createHmac("sha256", "chave").update(corpo).digest("base64");
  assert.equal(await hmacSha256Base64("chave", corpo), esperado);
});

test("comparação em tempo constante", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
});

test("sha256Hex é determinístico", async () => {
  assert.equal(await sha256Hex("a"), "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
});
