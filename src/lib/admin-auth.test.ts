import assert from "node:assert/strict";
import test from "node:test";
import { credentialsMatch, sessionValid, signSession } from "./admin-auth.server.ts";
import { sanitizeProduct } from "./product.ts";

test("session cookie verifies and expires", () => {
  const token = signSession(1_000_000, "secret");
  assert.equal(sessionValid(token, "secret", 999_000), true);
  assert.equal(sessionValid(token, "secret", 1_000_000), false);
  assert.equal(sessionValid(token, "other", 999_000), false);
  assert.equal(sessionValid("nope", "secret"), false);
});

test("username and password must both match", () => {
  assert.equal(credentialsMatch("max", "right", "max", "right"), true);
  assert.equal(credentialsMatch("max", "wrong", "max", "right"), false);
  assert.equal(credentialsMatch("nope", "right", "max", "right"), false);
});

test("product fields are required and bounded", () => {
  const ok = sanitizeProduct({
    title: "Ledger",
    specs: "Hardcover",
    description: "A book.",
    priceLabel: "$250",
    priceNote: "plus shipping",
    listed: false,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.product.listed, false);
  assert.equal(sanitizeProduct({ title: "" }).ok, false);
});
