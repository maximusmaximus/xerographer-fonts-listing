import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allFonts,
  categoryTree,
  formatFontSize,
  getFont,
  githubFontUrl,
  isLargeFontFile,
  LARGE_FONT_BYTES,
  largeFontNotice,
  parseFontSizeBytes,
  queryFonts,
  STATS,
  withSources,
} from "./fonts.ts";

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

  it("links every face to FFonts, Fonts2u, FontGet, WhatFontIs, and 1001 Free Fonts", () => {
    const crack = withSources(getFont("crackvetica")!);
    const ids = crack.hosts.map((h) => h.id as string);
    for (const id of ["ffonts", "fonts2u", "fontget", "whatfontis", "freefonts1001"]) {
      assert.ok(ids.includes(id), `missing ${id}`);
    }
    assert.match(crack.hosts.find((h) => h.id === "ffonts")?.url ?? "", /ffonts\.net\/Crackvetica\.font$/);
    assert.match(crack.hosts.find((h) => h.id === "fonts2u")?.url ?? "", /fonts2u\.com\/crackvetica\.font$/);
    assert.match(crack.hosts.find((h) => h.id === "fontget")?.url ?? "", /fontget\.com\/font\/crackvetica\/$/);
    assert.match(crack.hosts.find((h) => h.id === "whatfontis")?.url ?? "", /whatfontis\.com\/FF_Crackvetica\.font$/);
    assert.match(
      crack.hosts.find((h) => h.id === "freefonts1001")?.url ?? "",
      /1001freefonts\.com\/crackvetica\.font$/,
    );

    const fun = withSources(getFont("funsized")!);
    assert.match(fun.hosts.find((h) => h.id === "ffonts")?.url ?? "", /FunSized\.font$/);
    assert.match(fun.hosts.find((h) => h.id === "fontget")?.url ?? "", /font\/fun-sized\/$/);
    assert.match(fun.hosts.find((h) => h.id === "freefonts1001")?.url ?? "", /fun-sized\.font$/);

    const heat = withSources(getFont("hotsweat")!);
    assert.match(heat.hosts.find((h) => h.id === "freefonts1001")?.url ?? "", /hot-sweat\.font$/);

    const mirrors = ["ffonts", "fonts2u", "fontget", "whatfontis", "freefonts1001"];
    const every = allFonts().map((f) => withSources(f));
    assert.ok(every.every((f) => f.hosts.filter((h) => mirrors.includes(h.id)).length === 5));
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

  it("parses DaFont size strings and flags only large files", () => {
    assert.equal(parseFontSizeBytes("152 K"), 152 * 1024);
    assert.equal(parseFontSizeBytes("1256 K"), 1256 * 1024);
    assert.equal(parseFontSizeBytes("1.2 Mb"), Math.round(1.2 * 1024 * 1024));
    assert.equal(parseFontSizeBytes("82 K"), 82 * 1024);
    assert.equal(parseFontSizeBytes(null), null);
    assert.equal(parseFontSizeBytes("n/a"), null);
    assert.equal(formatFontSize(1256 * 1024), "1.2 MB");
    assert.equal(formatFontSize(515 * 1024), "515 KB");
    assert.equal(LARGE_FONT_BYTES, 500 * 1024);

    const large = getFont("finethings");
    const small = getFont("funsized");
    assert.ok(large);
    assert.ok(small);
    assert.equal(isLargeFontFile(large!), true);
    assert.equal(isLargeFontFile(small!), false);
    assert.match(largeFontNotice(large!) ?? "", /1\.2 MB/);
    assert.match(largeFontNotice(large!) ?? "", /computer or system/);
    assert.equal(largeFontNotice(small!), null);

    const flagged = allFonts().filter(isLargeFontFile);
    assert.ok(flagged.length >= 4);
    assert.ok(flagged.length < allFonts().length / 10);
    assert.ok(flagged.every((f) => (parseFontSizeBytes(f.size) ?? 0) >= LARGE_FONT_BYTES));
  });

  it("links every face to its folder in the public font repository", () => {
    assert.equal(
      githubFontUrl(getFont("funsized")!),
      "https://github.com/maximusmaximus/xerographer-fonts/tree/main/fonts/fancy/comic/funsized",
    );
    assert.equal(
      githubFontUrl(getFont("finethings")!),
      "https://github.com/maximusmaximus/xerographer-fonts/tree/main/fonts/fancy/eroded/finethings",
    );
    assert.equal(
      githubFontUrl(getFont("epicenter")!),
      "https://github.com/maximusmaximus/xerographer-fonts/tree/main/fonts/techno/sci-fi/epicenter",
    );
    const fun = withSources(getFont("funsized")!);
    assert.equal(
      fun.hosts.find((h) => h.id === "github")?.url,
      "https://github.com/maximusmaximus/xerographer-fonts/tree/main/fonts/fancy/comic/funsized",
    );
    assert.equal(
      githubFontUrl({ slug: "example", category: "Foreign look", subcategory: "Chinese, Jpn" }),
      "https://github.com/maximusmaximus/xerographer-fonts/tree/main/fonts/foreign-look/chinese-jpn/example",
    );
    assert.equal(
      githubFontUrl({ slug: "example", category: "Fancy", subcategory: "Stencil, Army" }),
      "https://github.com/maximusmaximus/xerographer-fonts/tree/main/fonts/fancy/stencil-army/example",
    );
  });
});
