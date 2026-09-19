import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyHandleResize,
  alignLayer,
  defaultShape,
  defaultTextLayer,
  layerBox,
  nudge,
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
