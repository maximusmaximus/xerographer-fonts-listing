import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allFonts, categoryTree, getFont, queryFonts, STATS, withSources } from "./fonts.ts";

describe("font catalog", () => {
  it("contains the full DaFont author library", () => {
    assert.equal(allFonts().length, 1376);
    assert.equal(STATS.count, 1376);
    assert.ok(STATS.dafontDownloads > 40_000_000);
    assert.ok(STATS.fontspaceDownloads > 800_000);
    assert.ok(STATS.webfontfreeDownloads > 400_000);
    assert.ok(STATS.downloads > 45_000_000);
  });

  it("finds popular faces by slug and links to other hosts", () => {
    const font = getFont("crackvetica");
    assert.ok(font);
    assert.equal(font?.name, "Crackvetica");
    const sourced = withSources(font!);
    assert.match(sourced.dafontUrl, /crackvetica\.font$/);
    assert.match(sourced.downloadUrl, /[?&]f=crackvetica/);
    assert.match(sourced.previewUrl, /crackvetica0\.png$/);
    const space = sourced.hosts.find((h) => h.id === "fontspace");
    assert.ok(space);
    assert.match(space?.url ?? "", /fontspace\.com\/.*crackvetica/);
    assert.ok((space?.downloads ?? 0) > 50_000);
    assert.ok(sourced.totalDownloads > font!.downloads);
  });

  it("attaches FontSpace, BlogFonts, and Hey Fonts pages where listed", () => {
    const fun = withSources(getFont("funsized")!);
    assert.ok(fun.hosts.some((h) => h.id === "fontspace" && h.url.includes("funsized-font-")));

    const blok = withSources(getFont("blokqued")!);
    assert.ok(blok.hosts.some((h) => h.id === "blogfonts" && h.url.includes("blokqued.font")));

    const brew = withSources(getFont("brewski")!);
    assert.ok(brew.hosts.some((h) => h.id === "heyfonts" && h.url.includes("brewski-font")));
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
