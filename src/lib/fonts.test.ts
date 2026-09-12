import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allFonts, categoryTree, getFont, queryFonts, STATS, withSources } from "./fonts.ts";

describe("font catalog", () => {
  it("contains the full DaFont author library", () => {
    assert.equal(allFonts().length, 1376);
    assert.equal(STATS.count, 1376);
    assert.ok(STATS.downloads > 10_000_000);
  });

  it("finds popular faces by slug", () => {
    const font = getFont("crackvetica");
    assert.ok(font);
    assert.equal(font?.name, "Crackvetica");
    const sourced = withSources(font!);
    assert.match(sourced.dafontUrl, /crackvetica\.font$/);
    assert.match(sourced.downloadUrl, /[?&]f=crackvetica/);
    assert.match(sourced.previewUrl, /crackvetica0\.png$/);
  });

  it("filters by category and search", () => {
    const eroded = queryFonts({ category: "Fancy", subcategory: "Eroded", limit: 10 });
    assert.ok(eroded.total > 50);
    assert.equal(eroded.fonts.length, 10);
    assert.ok(eroded.fonts.every((f) => f.subcategory === "Eroded"));

    const named = queryFonts({ q: "fun sized", limit: 5 });
    assert.ok(named.fonts.some((f) => f.slug === "funsized"));
  });

  it("sorts by name", () => {
    const page = queryFonts({ sort: "name", limit: 3 });
    const names = page.fonts.map((f) => f.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted);
  });

  it("builds a category tree from DaFont themes", () => {
    const tree = categoryTree();
    assert.ok(tree.length >= 6);
    const fancy = tree.find((c) => c.category === "Fancy");
    assert.ok(fancy && fancy.total > 500);
    assert.ok(fancy?.subcategories.some((s) => s.name === "Cartoon"));
  });
});
