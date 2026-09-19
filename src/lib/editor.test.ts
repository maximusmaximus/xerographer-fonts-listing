import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARTBOARDS,
  applyHandleResize,
  alignLayer,
  applyDepthLook,
  artboardOrientation,
  clampArtboard,
  defaultShape,
  defaultTextLayer,
  DEPTH_LOOKS,
  formatRatio,
  layerBox,
  matchArtboard,
  nudge,
  scaleLayers,
  snapValue,
  type Artboard,
} from "./editor.ts";

const board: Artboard = {
  width: 1000,
  height: 800,
  bg: "#111",
  bg2: "#222",
  paper: "solid",
  texture: "none",
  angle: 0,
  perspective: 0,
  perspectiveX: 50,
  perspectiveY: 50,
};

describe("editor geometry", () => {
  it("snaps to the grid when enabled", () => {
    assert.equal(snapValue(13, 8, true), 16);
    assert.equal(snapValue(13, 8, false), 13);
  });

  it("resizes from the southeast handle", () => {
    const next = applyHandleResize({ x: 10, y: 10, w: 100, h: 50 }, "se", 20, 10, false);
    assert.equal(next.w, 120);
    assert.equal(next.h, 60);
    assert.equal(next.x, 10);
  });

  it("keeps aspect when resizing from a corner", () => {
    const next = applyHandleResize({ x: 0, y: 0, w: 100, h: 50 }, "se", 50, 0, true);
    assert.equal(next.w, 150);
    assert.equal(next.h, 75);
  });

  it("aligns a layer to the artboard", () => {
    const layer = defaultShape("rect", board);
    layer.w = 200;
    layer.h = 100;
    layer.x = 10;
    layer.y = 10;
    assert.equal(alignLayer(layer, board, "center").x, 400);
    assert.equal(alignLayer(layer, board, "bottom").y, 700);
  });

  it("computes a text box from size and leading", () => {
    const text = defaultTextLayer("Hi\nThere", board);
    text.fontSize = 40;
    text.leading = 1.5;
    const box = layerBox(text);
    assert.equal(box.h, 120);
  });

  it("nudges by whole pixels", () => {
    const layer = defaultShape("ellipse", board);
    const next = nudge(layer, -4, 8);
    assert.equal(next.x, layer.x - 4);
    assert.equal(next.y, layer.y + 8);
  });
});

describe("artboard presets", () => {
  it("covers standard, social, banner, and 3D groups", () => {
    const groups = new Set(ARTBOARDS.map((item) => item.group));
    assert.deepEqual([...groups].sort(), ["banner", "social", "spatial", "standard"]);
    assert.ok(ARTBOARDS.length >= 20);
  });

  it("formats common ratios and orientations", () => {
    assert.equal(formatRatio(1920, 1080), "16:9");
    assert.equal(formatRatio(1080, 1080), "1:1");
    assert.equal(formatRatio(1080, 1920), "9:16");
    assert.equal(formatRatio(1200, 630), "1.91:1");
    assert.equal(formatRatio(1500, 500), "3:1");
    assert.equal(artboardOrientation(1920, 1080), "landscape");
    assert.equal(artboardOrientation(1080, 1920), "portrait");
    assert.equal(artboardOrientation(1080, 1080), "square");
  });

  it("matches a known social size", () => {
    const found = matchArtboard(1080, 1920);
    assert.ok(found);
    assert.equal(found?.height, 1920);
  });

  it("clamps custom canvas sizes", () => {
    assert.equal(clampArtboard(12), 320);
    assert.equal(clampArtboard(99999), 4096);
    assert.equal(clampArtboard(1080), 1080);
  });

  it("fits layers into a new canvas", () => {
    const layer = defaultShape("rect", board);
    layer.w = 400;
    layer.h = 200;
    layer.x = 0;
    layer.y = 0;
    const [next] = scaleLayers([layer], board, 2000, 1600);
    assert.equal(next?.w, 800);
    assert.equal(next && "h" in next ? next.h : 0, 400);
  });

  it("applies a 3D look onto type", () => {
    const text = defaultTextLayer("Hi", board);
    const look = DEPTH_LOOKS.find((item) => item.id === "block");
    assert.ok(look);
    const patch = applyDepthLook(text, look!);
    assert.equal(patch.rotateY, look!.rotateY);
    assert.equal(text.type === "text" ? (patch as { extrude?: number }).extrude : 0, look!.extrude);
  });
});
