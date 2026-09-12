import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spinChar } from "./spin-char.ts";

describe("catalog loading glyph", () => {
  it("picks a non-space character from the tester line", () => {
    const glyph = spinChar("HELLO XEROGRAPHER", "funsized");
    assert.match(glyph, /^[A-Z]$/);
    assert.equal(glyph.length, 1);
  });

  it("falls back when the tester is empty", () => {
    assert.equal(spinChar("   ", "crackvetica"), "x");
  });
});
