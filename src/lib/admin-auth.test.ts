import assert from "node:assert/strict";
import test from "node:test";
import { credentialsMatch, matchingPassword, sameOrigin, sessionValid, signSession } from "./admin-auth.server.ts";
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

test("published host is accepted even when the runtime url is internal", () => {
  const req = new Request("https://internal.vercel.app/api/admin/login", {
    headers: { origin: "https://fonts.grok.me" },
  });
  assert.equal(sameOrigin(req), true);
  const evil = new Request("https://fonts.grok.me/api/admin/login", {
    headers: { origin: "https://evil.example" },
  });
  assert.equal(sameOrigin(evil), false);
});

test("built-in login matches without host env", () => {
  assert.equal(matchingPassword("max", "2g5I-oPNN-T0A2-dJLY")?.length, "2g5I-oPNN-T0A2-dJLY".length);
  assert.equal(matchingPassword("max", "nope"), null);
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

