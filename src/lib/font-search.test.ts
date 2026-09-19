import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compositionHref, compositionOgHref, compositionOgPath, fontPreviewSearch, parseFontSearch, serializeComposition } from "./font-search.ts";

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

  it("parses playground composition and drops defaults", () => {
    const parsed = parseFontSearch({
      text: "Review this",
      size: "72",
      align: "center",
      track: "0.12",
      lead: "1.5",
      case: "upper",
    });
    assert.deepEqual(parsed, {
      text: "Review this",
      size: 72,
      align: "center",
      track: 0.12,
      lead: 1.5,
      case: "upper",
    });
    assert.deepEqual(
      serializeComposition({ text: "Review this", size: 72, align: "left", track: 0, lead: 1.15, case: "none" }),
      { text: "Review this", size: 72 },
    );
  });

  it("carries paper, ink, and texture on a share link", () => {
    const href = compositionHref(
      "/font/funsized",
      { text: "HELLO", paper: "linear", ink: "radial", tx: "grain", ang: 40, fg2: "#aabbcc", bg2: "#112233" },
      "https://fonts.example",
    );
    assert.match(href, /paper=linear/);
    assert.match(href, /ink=radial/);
    assert.match(href, /tx=grain/);
    assert.match(href, /ang=40/);
  });

  it("builds an absolute review link", () => {
    const href = compositionHref(
      "/font/funsized",
      { text: "HELLO", size: 64, fg: "#ffcc00", bg: "#1a3a2a", align: "center" },
      "https://fonts.example",
    );
    assert.equal(
      href,
      "https://fonts.example/font/funsized?text=HELLO&size=64&fg=%23ffcc00&bg=%231a3a2a&align=center",
    );
  });

  it("builds an og composition path with the font slug", () => {
    const path = compositionOgPath("/font/funsized", {
      text: "HELLO REVIEW",
      fg: "#ffcc00",
      bg: "#1a3a2a",
      align: "center",
    });
    assert.equal(
      path,
      "/api/og-composition?text=HELLO+REVIEW&fg=%23ffcc00&bg=%231a3a2a&align=center&slug=funsized",
    );
    assert.equal(
      compositionOgHref("/", { text: "HELLO REVIEW" }, "https://fonts.example"),
      "https://fonts.example/api/og-composition?text=HELLO+REVIEW",
    );
    assert.equal(compositionOgPath("/", {}), "");
  });
});
