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
  extrusionOffset,
  extrusionShadows,
  faceFamily,
  canvasFont,
  collectFaceSlugs,
  textFaceSlug,
  assignTextFace,
  layoutTypeLines,
  fitPad,
  fitScale,
  formatRatio,
  layerAffine,
  layerBox,
  layerMat4,
  layerMatrix3d,
  matchArtboard,
  matchDepthLook,
  mat4Identity,
  mat4Mul,
  nudge,
  scaleLayers,
  snapValue,
  transformPoint,
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

  it("fits the artboard to the stage, including zoom above 100%", () => {
    assert.equal(fitPad(390, 700), 16);
    assert.equal(fitPad(1280, 800), 40);
    assert.equal(fitPad(1920, 1080), 64);
    assert.equal(fitScale(1080, 1080, 1080, 1080, 0, 3), 1);
    assert.ok(fitScale(2000, 2000, 1080, 1080, 40, 3) > 1);
    const phone = fitScale(390, 640, 1080, 1080, 16, 3);
    assert.ok(phone < 0.4 && phone > 0.3);
  });

  it("applies a 3D look onto type", () => {
    const text = defaultTextLayer("Hi", board);
    const look = DEPTH_LOOKS.find((item) => item.id === "block");
    assert.ok(look);
    const patch = applyDepthLook(text, look!);
    assert.equal(patch.rotateY, look!.rotateY);
    assert.equal(text.type === "text" ? (patch as { extrude?: number }).extrude : 0, look!.extrude);
    const next = { ...text, ...patch } as typeof text;
    assert.ok(matchDepthLook(next, { ...board, perspective: look!.perspective, perspectiveX: look!.perspectiveX, perspectiveY: look!.perspectiveY }, look!));
  });
});

describe("3D projection", () => {
  it("multiplies identity without changing a matrix", () => {
    const id = mat4Identity();
    const moved = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1];
    assert.deepEqual(mat4Mul(id, moved), moved);
    assert.deepEqual(mat4Mul(moved, id), moved);
  });

  it("rotates 90 degrees clockwise in screen space", () => {
    const layer = defaultTextLayer("Hi", board);
    layer.rotation = 90;
    layer.rotateX = 0;
    layer.rotateY = 0;
    const p = transformPoint(layerMat4(layer, board), 10, 0, 0);
    assert.ok(Math.abs(p.x) < 1e-6, String(p.x));
    assert.ok(Math.abs(p.y - 10) < 1e-6, String(p.y));
  });

  it("bakes perspective so far points shrink", () => {
    const layer = defaultTextLayer("Hi", board);
    layer.rotateY = 50;
    const ortho = layerMat4(layer, { ...board, perspective: 0 });
    const persp = layerMat4(layer, { ...board, perspective: 900 });
    const o = transformPoint(ortho, 120, 0, 0);
    const p = transformPoint(persp, 120, 0, 0);
    assert.notEqual(layerMatrix3d(layer, { ...board, perspective: 900 }).includes("matrix3d("), false);
    assert.ok(Math.abs(p.x) < Math.abs(o.x) + 40);
    assert.notEqual(p.x.toFixed(3), o.x.toFixed(3));
  });

  it("emits a 16-value matrix3d string", () => {
    const layer = defaultTextLayer("Hi", board);
    const css = layerMatrix3d(layer, board);
    const nums = css.slice("matrix3d(".length, -1).split(",");
    assert.equal(nums.length, 16);
    assert.equal(css.startsWith("matrix3d("), true);
  });

  it("keeps identity affine when the layer is flat", () => {
    const layer = defaultTextLayer("Hi", board);
    const aff = layerAffine(layer, board);
    assert.ok(Math.abs(aff.a - 1) < 1e-6);
    assert.ok(Math.abs(aff.d - 1) < 1e-6);
    assert.ok(Math.abs(aff.b) < 1e-6);
    assert.ok(Math.abs(aff.c) < 1e-6);
  });

  it("builds extrusion shadows along projected depth", () => {
    const layer = defaultTextLayer("Hi", board);
    layer.extrude = 12;
    layer.rotateY = 30;
    const shadows = extrusionShadows(layer, { ...board, perspective: 1200 });
    assert.ok(shadows.includes("px"));
    assert.equal(shadows.split("px 0 ").length - 1, 12);
    const step = extrusionOffset(layer, { ...board, perspective: 1200 }, 8);
    assert.ok(Math.abs(step.x) > 0.5 || Math.abs(step.y) > 0.5);
  });

  it("matches every shipped look onto a type layer", () => {
    const text = defaultTextLayer("Hi", board);
    for (const look of DEPTH_LOOKS) {
      const next = { ...text, ...applyDepthLook(text, look) } as typeof text;
      const board2 = { ...board, perspective: look.perspective, perspectiveX: look.perspectiveX, perspectiveY: look.perspectiveY };
      assert.equal(matchDepthLook(next, board2, look), true, look.id);
    }
  });
});

describe("type faces", () => {
  it("keeps the page face until a layer picks another", () => {
    const text = defaultTextLayer("Hi", board);
    assert.equal(text.fontSlug, null);
    assert.equal(textFaceSlug(text, "funsized"), "funsized");
    assert.equal(faceFamily("funsized"), "xf-funsized");
    const picked = { ...text, ...assignTextFace("funsized", "crackvetica", "Crackvetica") };
    assert.equal(picked.fontSlug, "crackvetica");
    assert.equal(picked.name, "Crackvetica");
    assert.equal(textFaceSlug(picked, "funsized"), "crackvetica");
    const pageAgain = { ...picked, ...assignTextFace("funsized", "funsized", "Fun Sized") };
    assert.equal(pageAgain.fontSlug, null);
    const shape = defaultShape("rect", board);
    assert.deepEqual(collectFaceSlugs([text, shape, picked], "funsized"), ["funsized", "crackvetica"]);
    picked.hidden = true;
    assert.deepEqual(collectFaceSlugs([picked], "funsized", true), []);
  });

  it("quotes canvas families and never passes a css variable", () => {
    const spec = canvasFont(48, "xf-funsized");
    assert.equal(spec, '48px "xf-funsized"');
    assert.equal(spec.includes("var("), false);
    assert.equal(canvasFont(48.2, 'xf-a"b').includes('"'), true);
    assert.equal(canvasFont(Number.NaN, "xf-funsized"), '16px "xf-funsized"');
  });

  it("wraps type to the layer width, including a word wider than the box", () => {
    const measure = (value: string) => value.length * 10;
    const lines = layoutTypeLines("Hello there\nABCDEFGHIJ", 60, measure);
    assert.deepEqual(lines.map((line) => line.text), ["Hello", "there", "ABCDEF", "GHIJ"]);
    assert.deepEqual(layoutTypeLines("ABCD", 25, measure).map((line) => line.text), ["AB", "CD"]);
  });
});
