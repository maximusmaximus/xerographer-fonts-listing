import assert from "node:assert/strict";
import test from "node:test";
import { accentSamples, coverageFor, languageBadges, supportsAccents } from "./coverage.ts";

test("expanded faces report badges and samples", () => {
  assert.ok(coverageFor("funsized"));
  assert.ok(supportsAccents("funsized"));
  assert.ok(languageBadges("funsized").length > 0);
  assert.ok(accentSamples("funsized").length > 0);
});

test("unexpanded faces get no accent samples", () => {
  assert.equal(coverageFor("definitely-not-a-font"), null);
  assert.deepEqual(accentSamples("definitely-not-a-font"), []);
  assert.equal(supportsAccents("definitely-not-a-font"), false);
});
