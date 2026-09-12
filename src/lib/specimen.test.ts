import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCase,
  fileStem,
  lineOriginX,
  shouldJustify,
  specimenSvg,
  wordGap,
  wrapLines,
} from "./specimen.ts";

describe("specimen layout", () => {
  it("applies case modes", () => {
    assert.equal(applyCase("Fun Sized", "upper"), "FUN SIZED");
    assert.equal(applyCase("Fun Sized", "lower"), "fun sized");
    assert.equal(applyCase("fun sized", "title"), "Fun Sized");
    assert.equal(applyCase("Fun Sized", "none"), "Fun Sized");
  });

  it("wraps words to a measured width and marks paragraph ends", () => {
    const lines = wrapLines("aa bb cc dd", 5, (s) => s.length);
    assert.deepEqual(
      lines.map((l) => l.text),
      ["aa bb", "cc dd"],
    );
    assert.equal(lines[0]?.lastInParagraph, false);
    assert.equal(lines[1]?.lastInParagraph, true);
  });

  it("keeps explicit line breaks as paragraph ends", () => {
    const lines = wrapLines("one two\nthree", 100, (s) => s.length);
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.lastInParagraph, true);
    assert.equal(lines[1]?.text, "three");
  });

  it("justifies wrapped lines except the last in a paragraph", () => {
    const [first, last] = wrapLines("aa bb cc", 5, (s) => s.length);
    assert.equal(shouldJustify("justify", first!), true);
    assert.equal(shouldJustify("justify", last!), false);
    assert.equal(shouldJustify("left", first!), false);
  });

  it("places left, center, and right origins", () => {
    assert.equal(lineOriginX("left", 10, 40), 0);
    assert.equal(lineOriginX("center", 10, 40), 15);
    assert.equal(lineOriginX("right", 10, 40), 30);
  });

  it("spreads leftover width between words", () => {
    assert.equal(wordGap(["aa", "bb"], 20, (s) => s.length), 16);
  });

  it("builds an outlined svg document", () => {
    const svg = specimenSvg(100, 50, "#111111", "#eeeeee", ["M0 0L10 0"]);
    assert.match(svg, /fill="#111111"/);
    assert.match(svg, /fill="#eeeeee"/);
    assert.match(svg, /M0 0L10 0/);
    assert.equal(fileStem("crackvetica"), "crackvetica-specimen");
  });
});
