import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hexToHsv, hsvToHex, mixHex } from "./color.ts";
import { paperBackground } from "./surfaces.ts";

describe("studio color", () => {
  it("round-trips hex through hsv", () => {
    assert.equal(hsvToHex(0, 1, 1), "#ff0000");
    const hsv = hexToHsv("#33aaff");
    const back = hsvToHex(hsv.h, hsv.s, hsv.v);
    assert.match(back, /^#[0-9a-f]{6}$/);
  });

  it("builds a wash with texture, never a empty layer", () => {
    const css = paperBackground("#121212", "#d2652d", "linear", 155, "grain");
    assert.equal(css.backgroundColor, "#121212");
    assert.match(css.backgroundImage, /linear-gradient/);
    assert.match(css.backgroundImage, /feTurbulence/);
  });

  it("mixes two hex colors", () => {
    assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
  });
});
