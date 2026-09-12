import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fontPreviewSearch, parseFontSearch } from "./font-search.ts";

describe("font preview search", () => {
  it("omits empty tester text", () => {
    assert.deepEqual(fontPreviewSearch("   "), {});
  });

  it("carries typed text and size onto the font page", () => {
    assert.deepEqual(fontPreviewSearch("Hello Xerographer", 88, "#ff0000", "#00ff00"), {
      text: "Hello Xerographer",
      size: 88,
      fg: "#ff0000",
      bg: "#00ff00",
    });
  });

  it("parses query params and clamps size", () => {
    const parsed = parseFontSearch({ text: "  proof  ", size: "12", fg: "AABBCC", bg: "#ddeeff" });
    assert.equal(parsed.text, "proof");
    assert.equal(parsed.size, 28);
    assert.equal(parsed.fg, "#aabbcc");
    assert.equal(parsed.bg, "#ddeeff");
  });
});
