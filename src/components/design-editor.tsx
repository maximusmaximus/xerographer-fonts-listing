import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  BringToFront,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Circle,
  Copy,
  Download,
  Dices,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Hand,
  ImagePlus,
  Lock,
  Maximize2,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  SendToBack,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CanvasPicker } from "@/components/canvas-picker";
import { ColorWheel } from "@/components/color-wheel";
import { HintSpot } from "@/components/guide";
import { ShareComposition } from "@/components/share-composition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { currentTourStep, useGuide } from "@/lib/guide";
import {
  BLENDS,
  DEPTH_LOOKS,
  HANDLES,
  SNAP_GRID,
  alignLayer,
  applyDepthLook,
  applyHandleResize,
  artboardSceneStyle,
  artboardStyle,
  canvasBlend,
  cloneLayer,
  defaultImageLayer,
  defaultShape,
  defaultTextLayer,
  displayText,
  handleCursor,
  handleStyle,
  imageFilter,
  layerBox,
  layerCenter,
  layerCss,
  layerTransform,
  patchLayer,
  resizeLayer,
  rotatePoint,
  scaleLayers,
  selectedLayer,
  snapValue,
  type AlignTo,
  type Artboard,
  type Box,
  type DepthLook,
  type EditorDoc,
  type Handle,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from "@/lib/editor";
import { compositionHref, compositionOgHref, serializeComposition } from "@/lib/font-search";
import { mixHex } from "@/lib/color";
import { downloadBlob } from "@/lib/specimen-render.ts";
import { fileStem } from "@/lib/specimen.ts";
import {
  ATMOSPHERES,
  INK_MODES,
  PAPER_MODES,
  TEXTURES,
  paperBackground,
  type Atmosphere,
  type InkMode,
  type PaperMode,
  type TextureId,
} from "@/lib/surfaces";
import { cn } from "@/lib/utils";

type Tool = "select" | "type" | "rect" | "ellipse" | "image" | "hand";
type Panel = "paper" | "layer" | "type" | "fx" | "3d";

type Gesture =
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "resize"; id: string; handle: Handle; start: Box; rotation: number; cx: number; cy: number; fontSize: number; pointer: { x: number; y: number } }
  | { kind: "rotate"; id: string; start: number; origin: number }
  | { kind: "draw"; id: string; x0: number; y0: number }
  | { kind: "pan"; x: number; y: number; sl: number; st: number };

const DEFAULT_ARTBOARD: Artboard = {
  width: 1080,
  height: 1080,
  bg: ATMOSPHERES[0]!.bg,
  bg2: ATMOSPHERES[0]!.bg2,
  paper: "solid",
  texture: "grain",
  angle: 160,
  perspective: 0,
  perspectiveX: 50,
  perspectiveY: 50,
};

export function FontPlayground({
  slug,
  name,
  initialText,
  initialSize,
  initialFg,
  initialBg,
  initialAlign,
  initialTrack,
  initialLead,
  initialCase,
  initialFg2,
  initialBg2,
  initialPaper,
  initialInk,
  initialTexture,
  initialAngle,
}: {
  slug: string;
  name: string;
  initialText?: string;
  initialSize?: number;
  initialFg?: string;
  initialBg?: string;
  initialAlign?: TextLayer["align"];
  initialTrack?: number;
  initialLead?: number;
  initialCase?: TextLayer["caseMode"];
  initialFg2?: string;
  initialBg2?: string;
  initialPaper?: PaperMode;
  initialInk?: InkMode;
  initialTexture?: TextureId;
  initialAngle?: number;
}) {
  const navigate = useNavigate({ from: "/font/$slug" });
  const boardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const history = useRef<EditorDoc[]>([]);
  const future = useRef<EditorDoc[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const clip = useRef<Layer | null>(null);
  const space = useRef(false);
  const docRef = useRef<EditorDoc | null>(null);

  const seed = useMemo(() => {
    const artboard: Artboard = {
      ...DEFAULT_ARTBOARD,
      bg: initialBg ?? DEFAULT_ARTBOARD.bg,
      bg2: initialBg2 ?? DEFAULT_ARTBOARD.bg2,
      paper: initialPaper ?? "solid",
      texture: initialTexture ?? "grain",
      angle: initialAngle ?? 160,
    };
    const text = defaultTextLayer(initialText?.trim() || name, artboard, initialFg ?? "#f2efe6");
    text.id = "seed-type";
    if (initialSize) text.fontSize = initialSize;
    if (initialAlign) text.align = initialAlign;
    if (initialTrack != null) text.tracking = initialTrack;
    if (initialLead != null) text.leading = initialLead;
    if (initialCase) text.caseMode = initialCase;
    if (initialFg2) text.fill2 = initialFg2;
    if (initialInk) text.ink = initialInk;
    return { artboard, layers: [text], selectedId: text.id } satisfies EditorDoc;
  }, [initialAlign, initialAngle, initialBg, initialBg2, initialCase, initialFg, initialFg2, initialInk, initialLead, initialPaper, initialSize, initialText, initialTexture, initialTrack, name]);

  const [doc, setDoc] = useState<EditorDoc>(seed);
  const [tool, setTool] = useState<Tool>("select");
  const [panel, setPanel] = useState<Panel>("type");
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(0.4);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [snap, setSnap] = useState(true);
  const [busy, setBusy] = useState<"png" | "jpg" | "svg" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fitCanvas, setFitCanvas] = useState(true);
  const tourRoute = useGuide((s) => s.tourRoute);
  const tourIndex = useGuide((s) => s.tourIndex);

  docRef.current = doc;

  useEffect(() => {
    const step = currentTourStep(tourRoute, tourIndex);
    if (step?.id === "depth") setPanel("3d");
  }, [tourIndex, tourRoute]);

  useEffect(() => {
    let cancelled = false;
    const face = new FontFace(`xf-${slug}`, `url(/api/font-file/${slug})`);
    face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
        setReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || zoomMode !== "fit") return;
    const fit = () => {
      const pad = 32;
      const next = Math.min((stage.clientWidth - pad) / doc.artboard.width, (stage.clientHeight - pad) / doc.artboard.height, 1);
      setScale(Math.max(0.08, next));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [doc.artboard.width, doc.artboard.height, zoomMode]);

  const selected = selectedLayer(doc);
  const fontFamily = ready ? `xf-${slug}, var(--font-display)` : "var(--font-display)";
  const textLayer = selected?.type === "text" ? selected : doc.layers.find((l): l is TextLayer => l.type === "text");
  const activeTool = space.current ? "hand" : tool;

  const composition = useMemo(
    () => ({
      text: textLayer?.text ?? name,
      size: textLayer?.fontSize,
      fg: textLayer?.fill,
      bg: doc.artboard.bg,
      fg2: textLayer?.fill2,
      bg2: doc.artboard.bg2,
      align: textLayer?.align,
      track: textLayer?.tracking,
      lead: textLayer?.leading,
      case: textLayer?.caseMode,
      paper: doc.artboard.paper,
      ink: textLayer?.ink,
      tx: doc.artboard.texture,
      ang: doc.artboard.angle,
    }),
    [
      doc.artboard.angle,
      doc.artboard.bg,
      doc.artboard.bg2,
      doc.artboard.paper,
      doc.artboard.texture,
      name,
      textLayer?.align,
      textLayer?.caseMode,
      textLayer?.fill,
      textLayer?.fill2,
      textLayer?.fontSize,
      textLayer?.ink,
      textLayer?.leading,
      textLayer?.text,
      textLayer?.tracking,
    ],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void navigate({ params: { slug }, search: serializeComposition(composition), replace: true });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [composition, navigate, slug]);

  function commit(next: EditorDoc, record = true) {
    if (record) {
      history.current = [...history.current.slice(-39), doc];
      future.current = [];
    }
    setDoc(next);
  }

  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push(doc);
    setDoc(prev);
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(doc);
    setDoc(next);
  }

  function updateSelected(patch: Partial<Layer>) {
    if (!doc.selectedId) return;
    commit(patchLayer(doc, doc.selectedId, patch));
  }

  function addTextAt(x?: number, y?: number) {
    const layer = defaultTextLayer("Type here", doc.artboard, textLayer?.fill ?? "#f2efe6");
    if (x != null && y != null) {
      layer.x = Math.round(x);
      layer.y = Math.round(y);
      layer.w = Math.round(doc.artboard.width * 0.6);
    }
    commit({ ...doc, layers: [...doc.layers, layer], selectedId: layer.id });
    setTool("select");
    setPanel("type");
    setEditingId(layer.id);
  }

  function onPickImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      const probe = new Image();
      probe.onload = () => {
        const layer = defaultImageLayer(src, file.name.replace(/\.[^.]+$/, "") || "Image", doc.artboard, {
          w: probe.naturalWidth,
          h: probe.naturalHeight,
        });
        commit({ ...doc, layers: [...doc.layers, layer], selectedId: layer.id });
        setTool("select");
        setPanel("type");
      };
      probe.onerror = () => {
        const layer = defaultImageLayer(src, "Image", doc.artboard);
        commit({ ...doc, layers: [...doc.layers, layer], selectedId: layer.id });
        setTool("select");
      };
      probe.src = src;
    };
    reader.readAsDataURL(file);
  }

  function removeSelected() {
    if (!selected || selected.locked) return;
    const layers = doc.layers.filter((l) => l.id !== selected.id);
    commit({ ...doc, layers, selectedId: layers.at(-1)?.id ?? null });
    setEditingId(null);
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = cloneLayer(selected);
    commit({ ...doc, layers: [...doc.layers, copy], selectedId: copy.id });
  }

  function reorder(dir: 1 | -1) {
    if (!selected) return;
    const i = doc.layers.findIndex((l) => l.id === selected.id);
    const j = i + dir;
    if (j < 0 || j >= doc.layers.length) return;
    const layers = doc.layers.slice();
    const [item] = layers.splice(i, 1);
    layers.splice(j, 0, item!);
    commit({ ...doc, layers });
  }

  function applyAtmosphere(look: Atmosphere) {
    commit({
      ...doc,
      artboard: {
        ...doc.artboard,
        bg: look.bg,
        bg2: look.bg2,
        paper: look.paper,
        texture: look.texture,
        angle: look.angle,
      },
      layers: doc.layers.map((layer) =>
        layer.type === "text" ? { ...layer, fill: look.fg, fill2: look.fg2, ink: look.ink, angle: look.angle } : layer,
      ),
    });
  }

  function setArtboardSize(width: number, height: number) {
    const layers = fitCanvas ? scaleLayers(doc.layers, doc.artboard, width, height) : doc.layers;
    commit({ ...doc, artboard: { ...doc.artboard, width, height }, layers });
  }

  function applyLook(look: DepthLook) {
    const layers = selected
      ? doc.layers.map((layer) => (layer.id === selected.id ? ({ ...layer, ...applyDepthLook(layer, look) } as Layer) : layer))
      : doc.layers;
    commit({
      ...doc,
      artboard: {
        ...doc.artboard,
        perspective: look.perspective,
        perspectiveX: look.perspectiveX,
        perspectiveY: look.perspectiveY,
      },
      layers,
    });
  }

  const toBoard = useCallback((clientX: number, clientY: number) => {
    const el = boardRef.current;
    if (!el) return { x: 0, y: 0 };
    const box = el.getBoundingClientRect();
    return { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale };
  }, [scale]);

  function grid(n: number) {
    return snapValue(n, SNAP_GRID, snap);
  }

  function onStagePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (activeTool !== "hand" && tool !== "hand") return;
    const stage = stageRef.current;
    if (!stage) return;
    gesture.current = { kind: "pan", x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onBoardPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (tool === "hand" || space.current) return;
    if (editingId) setEditingId(null);
    const p = toBoard(e.clientX, e.clientY);
    if (tool === "type") {
      addTextAt(p.x, p.y);
      return;
    }
    if (tool === "rect" || tool === "ellipse") {
      const layer = defaultShape(tool, doc.artboard);
      layer.x = grid(p.x);
      layer.y = grid(p.y);
      layer.w = 8;
      layer.h = 8;
      commit({ ...doc, layers: [...doc.layers, layer], selectedId: layer.id });
      gesture.current = { kind: "draw", id: layer.id, x0: layer.x, y0: layer.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "image") {
      fileRef.current?.click();
      return;
    }
    if (e.target === e.currentTarget) {
      commit({ ...doc, selectedId: null }, false);
    }
  }

  function onBoardPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "draw") {
      const p = toBoard(e.clientX, e.clientY);
      const x = grid(Math.min(g.x0, p.x));
      const y = grid(Math.min(g.y0, p.y));
      const w = Math.max(8, grid(Math.abs(p.x - g.x0)));
      const h = Math.max(8, grid(Math.abs(p.y - g.y0)));
      setDoc((prev) => patchLayer(prev, g.id, e.shiftKey ? { x, y, w, h: w } : { x, y, w, h }));
    }
  }

  function onBoardPointerUp() {
    const g = gesture.current;
    if (g?.kind === "draw") {
      setDoc((prev) => {
        const layer = prev.layers.find((l) => l.id === g.id);
        if (!layer || layer.type === "text" || layer.type === "image") return prev;
        if (layer.w >= 24 && layer.h >= 24) return prev;
        const sized = defaultShape(layer.type, prev.artboard);
        return patchLayer(prev, layer.id, {
          w: sized.w,
          h: sized.h,
          x: Math.round(Math.min(layer.x, prev.artboard.width - sized.w)),
          y: Math.round(Math.min(layer.y, prev.artboard.height - sized.h)),
        });
      });
      history.current = [...history.current.slice(-39), doc];
      future.current = [];
      setTool("select");
      setPanel("type");
    }
    if (g?.kind === "draw" || g?.kind === "pan") gesture.current = null;
  }

  function onLayerPointerDown(e: ReactPointerEvent<HTMLElement>, layer: Layer) {
    e.stopPropagation();
    if (tool === "type" || tool === "rect" || tool === "ellipse") {
      onBoardPointerDown(e as unknown as ReactPointerEvent<HTMLDivElement>);
      return;
    }
    if (tool === "hand" || space.current || layer.locked) return;
    setEditingId(null);
    setDoc({ ...doc, selectedId: layer.id });
    const p = toBoard(e.clientX, e.clientY);
    gesture.current = { kind: "move", id: layer.id, dx: p.x - layer.x, dy: p.y - layer.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onLayerPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.kind !== "move" || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const p = toBoard(e.clientX, e.clientY);
    setDoc((prev) => patchLayer(prev, g.id, { x: grid(p.x - g.dx), y: grid(p.y - g.dy) }));
  }

  function onLayerPointerUp(e: ReactPointerEvent<HTMLElement>) {
    if (gesture.current?.kind === "move") {
      history.current = [...history.current.slice(-39), doc];
      future.current = [];
      gesture.current = null;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onResizeStart(e: ReactPointerEvent, handle: Handle, layer: Layer) {
    e.stopPropagation();
    e.preventDefault();
    const box = layerBox(layer);
    const c = layerCenter(layer);
    const p = toBoard(e.clientX, e.clientY);
    gesture.current = {
      kind: "resize",
      id: layer.id,
      handle,
      start: box,
      rotation: layer.rotation,
      cx: c.x,
      cy: c.y,
      fontSize: layer.type === "text" ? layer.fontSize : 0,
      pointer: p,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onRotateStart(e: ReactPointerEvent, layer: Layer) {
    e.stopPropagation();
    const c = layerCenter(layer);
    const p = toBoard(e.clientX, e.clientY);
    gesture.current = {
      kind: "rotate",
      id: layer.id,
      start: layer.rotation,
      origin: (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onHandleMove(e: ReactPointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const p = toBoard(e.clientX, e.clientY);
    if (g.kind === "resize") {
      const unNow = rotatePoint(p.x, p.y, g.cx, g.cy, -g.rotation);
      const unStart = rotatePoint(g.pointer.x, g.pointer.y, g.cx, g.cy, -g.rotation);
      const next = applyHandleResize(g.start, g.handle, unNow.x - unStart.x, unNow.y - unStart.y, e.shiftKey);
      setDoc((prev) => {
        const layer = prev.layers.find((l) => l.id === g.id);
        if (!layer) return prev;
        return patchLayer(prev, g.id, resizeLayer(layer, next));
      });
    } else if (g.kind === "rotate") {
      const layer = doc.layers.find((l) => l.id === g.id);
      if (!layer) return;
      const c = layerCenter(layer);
      const angle = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
      let rotation = g.start + (angle - g.origin);
      if (e.shiftKey) rotation = Math.round(rotation / 15) * 15;
      setDoc((prev) => patchLayer(prev, g.id, { rotation: Math.round(rotation) }));
    } else if (g.kind === "pan") {
      const stage = stageRef.current;
      if (!stage) return;
      stage.scrollLeft = g.sl - (e.clientX - g.x);
      stage.scrollTop = g.st - (e.clientY - g.y);
    }
  }

  function onHandleUp(e: ReactPointerEvent) {
    const g = gesture.current;
    if (g?.kind === "resize" || g?.kind === "rotate") {
      history.current = [...history.current.slice(-39), doc];
      future.current = [];
      gesture.current = null;
    }
    if (g?.kind === "pan") gesture.current = null;
    const node = e.currentTarget as HTMLElement;
    if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomMode("manual");
      setScale((s) => Math.min(3, Math.max(0.08, s * (e.deltaY < 0 ? 1.08 : 0.92))));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    function typing(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        space.current = true;
        if (!typing(e.target)) e.preventDefault();
      }
      if (typing(e.target)) return;
      const current = docRef.current;
      if (!current) return;
      const sel = selectedLayer(current);
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (meta && e.key.toLowerCase() === "c" && sel) {
        clip.current = sel;
      } else if (meta && e.key.toLowerCase() === "v" && clip.current) {
        e.preventDefault();
        const copy = cloneLayer(clip.current);
        commit({ ...current, layers: [...current.layers, copy], selectedId: copy.id });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "v") setTool("select");
      else if (e.key === "t") setTool("type");
      else if (e.key === "r") setTool("rect");
      else if (e.key === "o") setTool("ellipse");
      else if (e.key === "i") fileRef.current?.click();
      else if (e.key === "h") setTool("hand");
      else if (e.key === "[") reorder(-1);
      else if (e.key === "]") reorder(1);
      else if (e.key === "Escape") {
        setEditingId(null);
        setTool("select");
        commit({ ...current, selectedId: null }, false);
      } else if (sel && !sel.locked) {
        const step = e.shiftKey ? 10 : snap ? SNAP_GRID : 1;
        if (e.key === "ArrowLeft") updateSelected({ x: sel.x - step });
        if (e.key === "ArrowRight") updateSelected({ x: sel.x + step });
        if (e.key === "ArrowUp") updateSelected({ y: sel.y - step });
        if (e.key === "ArrowDown") updateSelected({ y: sel.y + step });
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.code === "Space") space.current = false;
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  });

  async function exportRaster(kind: "png" | "jpg") {
    setBusy(kind);
    setNote(null);
    try {
      const blob = await snapshotDoc(doc, fontFamily, kind);
      downloadBlob(blob, `${fileStem(slug)}.${kind === "jpg" ? "jpg" : "png"}`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not export");
    } finally {
      setBusy(null);
    }
  }

  async function exportSvg() {
    setBusy("svg");
    setNote(null);
    try {
      const svg = serializeBoardSvg(doc, fontFamily);
      downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileStem(slug)}.svg`);
    } finally {
      setBusy(null);
    }
  }

  function zoomBy(factor: number) {
    setZoomMode("manual");
    setScale((s) => Math.min(3, Math.max(0.08, s * factor)));
  }

  const handlePx = Math.max(8, 12 / scale);

  return (
    <div className="min-w-0 overflow-x-hidden rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]">
      <HintSpot id="tools">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        <ToolBtn pressed={tool === "select"} label="Select (V)" onClick={() => setTool("select")}>
          <MousePointer2 className="size-4" />
        </ToolBtn>
        <ToolBtn pressed={tool === "type"} label="Type (T)" onClick={() => setTool("type")}>
          <Type className="size-4" />
        </ToolBtn>
        <ToolBtn pressed={tool === "rect"} label="Rectangle (R)" onClick={() => setTool("rect")}>
          <Square className="size-4" />
        </ToolBtn>
        <ToolBtn pressed={tool === "ellipse"} label="Ellipse (O)" onClick={() => setTool("ellipse")}>
          <Circle className="size-4" />
        </ToolBtn>
        <ToolBtn pressed={false} label="Place image (I)" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-4" />
        </ToolBtn>
        <ToolBtn pressed={tool === "hand"} label="Hand (H)" onClick={() => setTool("hand")}>
          <Hand className="size-4" />
        </ToolBtn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); e.target.value = ""; }} />
        <span className="mx-1 h-6 w-px bg-border" />
        <ToolBtn label="Undo" onClick={undo}><Undo2 className="size-4" /></ToolBtn>
        <ToolBtn label="Redo" onClick={redo}><Redo2 className="size-4" /></ToolBtn>
        <ToolBtn label="Duplicate" onClick={duplicateSelected}><Copy className="size-4" /></ToolBtn>
        <ToolBtn label="Delete" onClick={removeSelected}><Trash2 className="size-4" /></ToolBtn>
        <ToolBtn pressed={snap} label="Snap to grid" onClick={() => setSnap((v) => !v)}><Grid3x3 className="size-4" /></ToolBtn>
        <HintSpot id="canvas" className="ml-auto">
          <CanvasPicker
            width={doc.artboard.width}
            height={doc.artboard.height}
            fit={fitCanvas}
            onFitChange={setFitCanvas}
            onPick={setArtboardSize}
          />
        </HintSpot>
      </div>
      </HintSpot>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <HintSpot id="studio">
        <div
          ref={stageRef}
          className={cn("editor-stage relative min-h-[22rem] overflow-auto bg-bg sm:min-h-[28rem]", tool === "hand" || space.current ? "cursor-grab" : "")}
          onPointerDown={onStagePointerDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative shrink-0"
              style={{
                width: doc.artboard.width * scale,
                height: doc.artboard.height * scale,
                ...artboardSceneStyle(doc.artboard, scale),
              }}
            >
              <div
                ref={boardRef}
                data-specimen
                className={cn("absolute left-0 top-0 origin-top-left shadow-[var(--shadow-border)]", tool === "type" ? "cursor-text" : tool === "rect" || tool === "ellipse" ? "cursor-crosshair" : "cursor-default")}
                style={{
                  ...artboardStyle(doc.artboard),
                  transform: `scale(${scale})`,
                }}
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerUp={onBoardPointerUp}
              >
                {!ready ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40">
                    <span className="glyph-spin select-none font-display text-6xl leading-none text-fg">x</span>
                  </div>
                ) : null}
                {doc.layers.map((layer) => (
                  <LayerView
                    key={layer.id}
                    layer={layer}
                    fontFamily={fontFamily}
                    selected={layer.id === doc.selectedId}
                    editing={layer.id === editingId}
                    onPointerDown={(ev) => onLayerPointerDown(ev, layer)}
                    onPointerMove={onLayerPointerMove}
                    onPointerUp={onLayerPointerUp}
                    onEditStart={() => { setEditingId(layer.id); setDoc({ ...doc, selectedId: layer.id }); setPanel("type"); }}
                    onEditEnd={(text) => { commit(patchLayer(doc, layer.id, { text } as Partial<Layer>)); setEditingId(null); }}
                  />
                ))}
                {selected && !selected.hidden && editingId !== selected.id ? (
                  <TransformFrame
                    layer={selected}
                    handleSize={handlePx}
                    onResizeStart={onResizeStart}
                    onRotateStart={onRotateStart}
                    onMove={onHandleMove}
                    onUp={onHandleUp}
                  />
                ) : null}
              </div>
            </div>
          </div>
          <div className="pointer-events-none sticky bottom-3 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-bg-elevated/95 px-2 py-1 shadow-[var(--shadow-border)]">
              <ToolBtn label="Zoom out" onClick={() => zoomBy(0.9)}><ZoomOut className="size-4" /></ToolBtn>
              <button type="button" className="h-11 min-w-14 px-2 font-mono text-xs tabular-nums text-fg-muted" onClick={() => { setZoomMode("manual"); setScale(1); }}>
                {Math.round(scale * 100)}%
              </button>
              <ToolBtn label="Zoom in" onClick={() => zoomBy(1.1)}><ZoomIn className="size-4" /></ToolBtn>
              <ToolBtn label="Fit" onClick={() => setZoomMode("fit")}><Maximize2 className="size-4" /></ToolBtn>
            </div>
          </div>
        </div>
        </HintSpot>

        <aside className="min-w-0 border-t border-border lg:border-l lg:border-t-0">
          <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
            {(["paper", "layer", "type", "fx", "3d"] as const).map((key) => {
              const tab = (
                <button
                  type="button"
                  onClick={() => setPanel(key)}
                  className={cn(
                    "h-11 shrink-0 rounded-full px-3 text-sm capitalize",
                    panel === key ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg-muted hover:text-fg",
                  )}
                >
                  {key === "fx" ? "FX" : key === "3d" ? "3D" : key}
                </button>
              );
              return key === "3d" ? (
                <HintSpot id="depth" key={key} className="shrink-0">
                  {tab}
                </HintSpot>
              ) : (
                <span key={key} className="contents">
                  {tab}
                </span>
              );
            })}
          </div>

          <div className="max-h-[28rem] space-y-4 overflow-y-auto p-3 lg:max-h-[34rem]">
            {panel === "paper" ? (
              <>
                <ModeRow options={PAPER_MODES} value={doc.artboard.paper} onChange={(paper) => commit({ ...doc, artboard: { ...doc.artboard, paper } })} />
                <ColorWheel label="Paper" value={doc.artboard.bg} onChange={(bg) => commit({ ...doc, artboard: { ...doc.artboard, bg } })} size={120} />
                {doc.artboard.paper !== "solid" ? (
                  <ColorWheel label="Wash" value={doc.artboard.bg2} onChange={(bg2) => commit({ ...doc, artboard: { ...doc.artboard, bg2 } })} size={120} />
                ) : null}
                <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">Tooth</p>
                <div className="flex flex-wrap gap-2">
                  {TEXTURES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={item.label}
                      onClick={() => commit({ ...doc, artboard: { ...doc.artboard, texture: item.id } })}
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full text-[10px] uppercase tracking-[0.12em]",
                        doc.artboard.texture === item.id ? "shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-[var(--shadow-border)]",
                      )}
                      style={paperBackground(doc.artboard.bg, doc.artboard.bg2, doc.artboard.paper, doc.artboard.angle, item.id) as CSSProperties}
                    >
                      <span className="rounded-full bg-bg/70 px-1.5 text-fg">{item.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">Atmospheres</p>
                <div className="flex flex-wrap gap-2">
                  {ATMOSPHERES.map((look) => (
                    <button
                      key={look.id}
                      type="button"
                      aria-label={look.name}
                      onClick={() => applyAtmosphere(look)}
                      className="size-12 rounded-full"
                      style={paperBackground(look.bg, look.bg2, look.paper, look.angle, look.texture) as CSSProperties}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {panel === "layer" ? (
              <>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => addTextAt()}><Plus className="size-4" />Type</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => reorder(1)}><BringToFront className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => reorder(-1)}><SendToBack className="size-4" /></Button>
                </div>
                <ul className="space-y-1">
                  {[...doc.layers].reverse().map((layer) => (
                    <li key={layer.id}>
                      <button
                        type="button"
                        onClick={() => { setDoc({ ...doc, selectedId: layer.id }); setPanel(layer.type === "text" ? "type" : "fx"); }}
                        className={cn(
                          "flex h-11 w-full items-center gap-2 rounded-sm px-2 text-left text-sm",
                          layer.id === doc.selectedId ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{layer.name}</span>
                        <span
                          role="button"
                          className="inline-flex size-8 items-center justify-center"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            commit(patchLayer(doc, layer.id, { hidden: !layer.hidden }));
                          }}
                        >
                          {layer.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </span>
                        <span
                          role="button"
                          className="inline-flex size-8 items-center justify-center"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            commit(patchLayer(doc, layer.id, { locked: !layer.locked }));
                          }}
                        >
                          {layer.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {selected ? (
                  <>
                    <TransformInspect
                      layer={selected}
                      artboard={doc.artboard}
                      onChange={updateSelected}
                      onAlign={(where) => updateSelected(alignLayer(selected, doc.artboard, where))}
                      onFlipX={() => updateSelected({ flipX: !selected.flipX })}
                      onFlipY={() => updateSelected({ flipY: !selected.flipY })}
                    />
                    <RangeStrip label="Opacity" min={0.05} max={1} step={0.05} value={selected.opacity} display={`${Math.round(selected.opacity * 100)}%`} onChange={(opacity) => updateSelected({ opacity })} />
                    <RangeStrip label="Rotate" min={-180} max={180} step={1} value={selected.rotation} display={`${Math.round(selected.rotation)}°`} onChange={(rotation) => updateSelected({ rotation })} />
                    <label className="block text-xs uppercase tracking-[0.16em] text-fg-muted">
                      Blend
                      <select
                        className="mt-1 h-11 w-full rounded-sm bg-bg-subtle px-2 text-sm normal-case tracking-normal text-fg"
                        value={selected.blend}
                        onChange={(ev) => updateSelected({ blend: ev.target.value as Layer["blend"] })}
                      >
                        {BLENDS.map((blend) => (
                          <option key={blend.id} value={blend.id}>{blend.label}</option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <p className="text-sm text-fg-muted">Select a layer, or choose Type and click the board.</p>
                )}
              </>
            ) : null}

            {panel === "type" && selected?.type === "text" ? (
              <TypeInspect layer={selected} onChange={updateSelected} />
            ) : null}
            {panel === "type" && selected && selected.type !== "text" ? (
              <ShapeInspect layer={selected} onChange={updateSelected} />
            ) : null}
            {panel === "type" && !selected ? <p className="text-sm text-fg-muted">Select a type layer, or press T and click the board.</p> : null}

            {panel === "fx" && selected?.type === "text" ? (
              <FxInspect layer={selected} onChange={updateSelected} />
            ) : null}
            {panel === "fx" && selected?.type === "image" ? (
              <ImageFx layer={selected} onChange={updateSelected} />
            ) : null}
            {panel === "fx" && selected && (selected.type === "rect" || selected.type === "ellipse") ? (
              <ShapeInspect layer={selected} onChange={updateSelected} />
            ) : null}
            {panel === "fx" && !selected ? <p className="text-sm text-fg-muted">Select a layer to add shadow, stroke, glow, or photo adjustments.</p> : null}

            {panel === "3d" ? (
              <DepthInspect
                artboard={doc.artboard}
                layer={selected}
                onArtboard={(patch) => commit({ ...doc, artboard: { ...doc.artboard, ...patch } })}
                onLayer={updateSelected}
                onLook={applyLook}
              />
            ) : null}
          </div>
        </aside>
      </div>

      <HintSpot id="export">
      <div className="flex flex-wrap gap-2 border-t border-border p-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => applyAtmosphere(ATMOSPHERES[Math.floor(Math.random() * ATMOSPHERES.length)]!)}>
          <Dices className="size-4" />
          Shuffle
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => commit(seed)}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <ShareComposition
          url={compositionHref(`/font/${slug}`, composition)}
          ogUrl={compositionOgHref(`/font/${slug}`, composition)}
          title={`${name}: ${textLayer?.text ?? name}`}
        />
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void exportRaster("png")}>
          <Download className="size-4" />
          {busy === "png" ? "Saving…" : "PNG"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void exportRaster("jpg")}>
          <Download className="size-4" />
          {busy === "jpg" ? "Saving…" : "JPG"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void exportSvg()}>
          <Download className="size-4" />
          {busy === "svg" ? "Saving…" : "SVG"}
        </Button>
        {note ? <p className="w-full text-sm text-fg-muted">{note}</p> : null}
      </div>
      </HintSpot>
    </div>
  );
}

function TransformFrame({
  layer,
  handleSize,
  onResizeStart,
  onRotateStart,
  onMove,
  onUp,
}: {
  layer: Layer;
  handleSize: number;
  onResizeStart: (e: ReactPointerEvent, handle: Handle, layer: Layer) => void;
  onRotateStart: (e: ReactPointerEvent, layer: Layer) => void;
  onMove: (e: ReactPointerEvent) => void;
  onUp: (e: ReactPointerEvent) => void;
}) {
  const box = layerBox(layer);
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        transform: layerTransform(layer, false),
        transformOrigin: "center center",
        transformStyle: "preserve-3d",
        outline: "1px solid var(--color-accent)",
        outlineOffset: 1,
      }}
    >
      <span
        className="editor-rotate"
        style={{ top: -18 - handleSize, marginLeft: -handleSize / 2, width: handleSize, height: handleSize }}
        onPointerDown={(e) => onRotateStart(e, layer)}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
      {HANDLES.map((handle) => (
        <span
          key={handle}
          className="editor-handle"
          style={{ ...handleStyle(handle, box, handleSize), cursor: handleCursor(handle, layer.rotation) }}
          onPointerDown={(e) => onResizeStart(e, handle, layer)}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
      ))}
    </div>
  );
}

function LayerView({
  layer,
  fontFamily,
  editing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onEditStart,
  onEditEnd,
}: {
  layer: Layer;
  fontFamily: string;
  selected: boolean;
  editing: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onEditStart: () => void;
  onEditEnd: (text: string) => void;
}) {
  const style = layerCss(layer, fontFamily);
  if (layer.type === "text") {
    if (editing) {
      return (
        <TextEdit
          layer={layer}
          style={style}
          onEditEnd={onEditEnd}
        />
      );
    }
    return (
      <p
        data-layer={layer.id}
        className="cursor-move select-none"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={(e) => { e.stopPropagation(); onEditStart(); }}
      >
        {displayText(layer)}
      </p>
    );
  }
  if (layer.type === "image") {
    return (
      <img
        src={layer.src}
        alt={layer.name}
        draggable={false}
        className="cursor-move object-cover"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    );
  }
  return (
    <div
      className="cursor-move"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

function TextEdit({
  layer,
  style,
  onEditEnd,
}: {
  layer: TextLayer;
  style: CSSProperties;
  onEditEnd: (text: string) => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);
  return (
    <p
      ref={ref}
      data-layer={layer.id}
      contentEditable
      suppressContentEditableWarning
      className="cursor-text outline outline-2 outline-accent"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onEditEnd(e.currentTarget.innerText.replace(/\u00a0/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    >
      {layer.text}
    </p>
  );
}

function DepthInspect({
  artboard,
  layer,
  onArtboard,
  onLayer,
  onLook,
}: {
  artboard: Artboard;
  layer: Layer | undefined;
  onArtboard: (patch: Partial<Artboard>) => void;
  onLayer: (patch: Partial<Layer>) => void;
  onLook: (look: DepthLook) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">Looks</p>
      <div className="flex flex-wrap gap-1">
        {DEPTH_LOOKS.map((look) => (
          <button
            key={look.id}
            type="button"
            onClick={() => onLook(look)}
            className="h-11 rounded-full bg-bg-subtle px-3 text-sm text-fg-muted hover:text-fg"
          >
            {look.label}
          </button>
        ))}
      </div>
      <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">Camera</p>
      <RangeStrip
        label="Persp"
        min={0}
        max={2400}
        step={20}
        value={artboard.perspective}
        display={artboard.perspective === 0 ? "off" : `${artboard.perspective}`}
        onChange={(perspective) => onArtboard({ perspective })}
      />
      <RangeStrip
        label="Origin X"
        min={0}
        max={100}
        step={1}
        value={artboard.perspectiveX}
        display={`${Math.round(artboard.perspectiveX)}%`}
        onChange={(perspectiveX) => onArtboard({ perspectiveX })}
      />
      <RangeStrip
        label="Origin Y"
        min={0}
        max={100}
        step={1}
        value={artboard.perspectiveY}
        display={`${Math.round(artboard.perspectiveY)}%`}
        onChange={(perspectiveY) => onArtboard({ perspectiveY })}
      />
      {layer ? (
        <>
          <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">Layer</p>
          <RangeStrip
            label="Tilt X"
            min={-80}
            max={80}
            step={1}
            value={layer.rotateX}
            display={`${Math.round(layer.rotateX)}°`}
            onChange={(rotateX) => {
              onLayer({ rotateX });
              if (!artboard.perspective && rotateX) onArtboard({ perspective: 1200 });
            }}
          />
          <RangeStrip
            label="Tilt Y"
            min={-80}
            max={80}
            step={1}
            value={layer.rotateY}
            display={`${Math.round(layer.rotateY)}°`}
            onChange={(rotateY) => {
              onLayer({ rotateY });
              if (!artboard.perspective && rotateY) onArtboard({ perspective: 1200 });
            }}
          />
          <RangeStrip label="Depth" min={-200} max={240} step={1} value={layer.translateZ} display={`${Math.round(layer.translateZ)}`} onChange={(translateZ) => onLayer({ translateZ })} />
          {layer.type === "text" ? (
            <RangeStrip label="Extrude" min={0} max={48} step={1} value={layer.extrude} display={`${Math.round(layer.extrude)}`} onChange={(extrude) => onLayer({ extrude })} />
          ) : null}
        </>
      ) : (
        <p className="text-sm text-fg-muted">Select a layer to tilt, push in depth, or extrude type.</p>
      )}
    </div>
  );
}

function TransformInspect({
  layer,
  artboard,
  onChange,
  onAlign,
  onFlipX,
  onFlipY,
}: {
  layer: Layer;
  artboard: Artboard;
  onChange: (patch: Partial<Layer>) => void;
  onAlign: (where: AlignTo) => void;
  onFlipX: () => void;
  onFlipY: () => void;
}) {
  const box = layerBox(layer);
  void artboard;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <NumField label="X" value={Math.round(layer.x)} onChange={(x) => onChange({ x })} />
        <NumField label="Y" value={Math.round(layer.y)} onChange={(y) => onChange({ y })} />
        <NumField label="W" value={Math.round(box.w)} onChange={(w) => onChange(layer.type === "text" ? { w } : { w })} />
        <NumField label="H" value={Math.round(box.h)} onChange={(h) => onChange(layer.type === "text" ? resizeLayer(layer, { ...box, h }) : { h })} />
      </div>
      <div className="flex flex-wrap gap-1">
        <ToolBtn label="Align left" onClick={() => onAlign("left")}><AlignHorizontalJustifyStart className="size-4" /></ToolBtn>
        <ToolBtn label="Align center" onClick={() => onAlign("center")}><AlignHorizontalJustifyCenter className="size-4" /></ToolBtn>
        <ToolBtn label="Align right" onClick={() => onAlign("right")}><AlignHorizontalJustifyEnd className="size-4" /></ToolBtn>
        <ToolBtn label="Align top" onClick={() => onAlign("top")}><AlignVerticalJustifyStart className="size-4" /></ToolBtn>
        <ToolBtn label="Align middle" onClick={() => onAlign("middle")}><AlignVerticalJustifyCenter className="size-4" /></ToolBtn>
        <ToolBtn label="Align bottom" onClick={() => onAlign("bottom")}><AlignVerticalJustifyEnd className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.flipX} label="Flip horizontal" onClick={onFlipX}><FlipHorizontal2 className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.flipY} label="Flip vertical" onClick={onFlipY}><FlipVertical2 className="size-4" /></ToolBtn>
      </div>
    </div>
  );
}

function TypeInspect({ layer, onChange }: { layer: TextLayer; onChange: (patch: Partial<TextLayer>) => void }) {
  return (
    <div className="space-y-3">
      <Textarea value={layer.text} rows={3} aria-label="Layer text" onChange={(e) => onChange({ text: e.target.value })} />
      <RangeStrip label="Size" min={18} max={320} step={1} value={layer.fontSize} display={`${layer.fontSize}`} onChange={(fontSize) => onChange({ fontSize })} />
      <RangeStrip label="Track" min={-0.08} max={0.28} step={0.01} value={layer.tracking} display={layer.tracking.toFixed(2)} onChange={(tracking) => onChange({ tracking })} />
      <RangeStrip label="Lead" min={0.8} max={2.2} step={0.05} value={layer.leading} display={layer.leading.toFixed(2)} onChange={(leading) => onChange({ leading })} />
      <div className="flex flex-wrap gap-1">
        <ToolBtn pressed={layer.align === "left"} label="Align left" onClick={() => onChange({ align: "left" })}><AlignLeft className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.align === "center"} label="Align center" onClick={() => onChange({ align: "center" })}><AlignCenter className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.align === "right"} label="Align right" onClick={() => onChange({ align: "right" })}><AlignRight className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.align === "justify"} label="Justify" onClick={() => onChange({ align: "justify" })}><AlignJustify className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.caseMode === "none"} label="As typed" onClick={() => onChange({ caseMode: "none" })}><CaseSensitive className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.caseMode === "upper"} label="Uppercase" onClick={() => onChange({ caseMode: "upper" })}><CaseUpper className="size-4" /></ToolBtn>
        <ToolBtn pressed={layer.caseMode === "lower"} label="Lowercase" onClick={() => onChange({ caseMode: "lower" })}><CaseLower className="size-4" /></ToolBtn>
      </div>
      <ModeRow options={INK_MODES} value={layer.ink} onChange={(ink) => onChange({ ink })} />
      <ColorWheel label="Ink" value={layer.fill} onChange={(fill) => onChange({ fill })} size={120} />
      {layer.ink !== "solid" ? <ColorWheel label="Fade" value={layer.fill2} onChange={(fill2) => onChange({ fill2 })} size={120} /> : null}
    </div>
  );
}

function ShapeInspect({ layer, onChange }: { layer: ShapeLayer | ImageLayer; onChange: (patch: Partial<Layer>) => void }) {
  if (layer.type === "image") {
    return (
      <div className="space-y-3">
        <RangeStrip label="Width" min={40} max={2400} step={1} value={layer.w} display={`${Math.round(layer.w)}`} onChange={(w) => onChange({ w })} />
        <RangeStrip label="Height" min={40} max={2400} step={1} value={layer.h} display={`${Math.round(layer.h)}`} onChange={(h) => onChange({ h })} />
        <p className="text-sm text-fg-muted">Photo adjustments live in FX.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ColorWheel label="Fill" value={layer.fill} onChange={(fill) => onChange({ fill })} size={120} />
      <ModeRow options={PAPER_MODES} value={layer.paper} onChange={(paper) => onChange({ paper })} />
      {layer.paper !== "solid" ? <ColorWheel label="Wash" value={layer.fill2} onChange={(fill2) => onChange({ fill2 })} size={120} /> : null}
      <RangeStrip label="Stroke" min={0} max={48} step={1} value={layer.strokeWidth} display={`${layer.strokeWidth}`} onChange={(strokeWidth) => onChange({ strokeWidth })} />
      {layer.strokeWidth > 0 ? <ColorWheel label="Stroke" value={layer.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} size={120} /> : null}
      {layer.type === "rect" ? (
        <RangeStrip label="Radius" min={0} max={400} step={1} value={layer.radius} display={`${layer.radius}`} onChange={(radius) => onChange({ radius })} />
      ) : null}
      <RangeStrip label="Shadow X" min={-60} max={60} step={1} value={layer.shadowX} display={`${layer.shadowX}`} onChange={(shadowX) => onChange({ shadowX })} />
      <RangeStrip label="Shadow Y" min={-60} max={60} step={1} value={layer.shadowY} display={`${layer.shadowY}`} onChange={(shadowY) => onChange({ shadowY })} />
      <RangeStrip label="Blur" min={0} max={80} step={1} value={layer.shadowBlur} display={`${layer.shadowBlur}`} onChange={(shadowBlur) => onChange({ shadowBlur })} />
      {layer.shadowBlur > 0 || layer.shadowX || layer.shadowY ? (
        <ColorWheel label="Shadow" value={layer.shadowColor} onChange={(shadowColor) => onChange({ shadowColor })} size={120} />
      ) : null}
    </div>
  );
}

function FxInspect({ layer, onChange }: { layer: TextLayer; onChange: (patch: Partial<TextLayer>) => void }) {
  return (
    <div className="space-y-3">
      <RangeStrip label="Stroke" min={0} max={16} step={0.5} value={layer.strokeWidth} display={`${layer.strokeWidth}`} onChange={(strokeWidth) => onChange({ strokeWidth })} />
      {layer.strokeWidth > 0 ? <ColorWheel label="Stroke" value={layer.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} size={120} /> : null}
      <RangeStrip label="Shadow X" min={-40} max={40} step={1} value={layer.shadowX} display={`${layer.shadowX}`} onChange={(shadowX) => onChange({ shadowX })} />
      <RangeStrip label="Shadow Y" min={-40} max={40} step={1} value={layer.shadowY} display={`${layer.shadowY}`} onChange={(shadowY) => onChange({ shadowY })} />
      <RangeStrip label="Blur" min={0} max={60} step={1} value={layer.shadowBlur} display={`${layer.shadowBlur}`} onChange={(shadowBlur) => onChange({ shadowBlur })} />
      <ColorWheel label="Shadow" value={layer.shadowColor} onChange={(shadowColor) => onChange({ shadowColor })} size={120} />
      <RangeStrip label="Glow" min={0} max={80} step={1} value={layer.glow} display={`${layer.glow}`} onChange={(glow) => onChange({ glow })} />
      {layer.glow > 0 ? <ColorWheel label="Glow" value={layer.glowColor} onChange={(glowColor) => onChange({ glowColor })} size={120} /> : null}
    </div>
  );
}

function ImageFx({ layer, onChange }: { layer: ImageLayer; onChange: (patch: Partial<ImageLayer>) => void }) {
  return (
    <div className="space-y-3">
      <RangeStrip label="Bright" min={0.2} max={2} step={0.05} value={layer.bright} display={layer.bright.toFixed(2)} onChange={(bright) => onChange({ bright })} />
      <RangeStrip label="Contrast" min={0.2} max={2} step={0.05} value={layer.contrast} display={layer.contrast.toFixed(2)} onChange={(contrast) => onChange({ contrast })} />
      <RangeStrip label="Saturate" min={0} max={2.5} step={0.05} value={layer.saturate} display={layer.saturate.toFixed(2)} onChange={(saturate) => onChange({ saturate })} />
      <RangeStrip label="Blur" min={0} max={40} step={1} value={layer.blur} display={`${layer.blur}`} onChange={(blur) => onChange({ blur })} />
      <RangeStrip label="Gray" min={0} max={1} step={0.05} value={layer.gray} display={`${Math.round(layer.gray * 100)}%`} onChange={(gray) => onChange({ gray })} />
      <RangeStrip label="Invert" min={0} max={1} step={0.05} value={layer.invert} display={`${Math.round(layer.invert * 100)}%`} onChange={(invert) => onChange({ invert })} />
    </div>
  );
}

function ToolBtn({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full transition-colors duration-150 ease-out",
        pressed ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg hover:bg-bg-elevated",
      )}
    >
      {children}
    </button>
  );
}

function ModeRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "h-11 rounded-full px-3 text-sm",
            value === option.id ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RangeStrip({
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  display: string;
}) {
  return (
    <label className="flex min-w-0 items-center gap-3 text-xs uppercase tracking-[0.16em] text-fg-muted">
      <span className="w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full min-w-0 accent-accent"
        aria-label={label}
      />
      <span className="w-12 shrink-0 font-mono text-xs tabular-nums normal-case tracking-normal">{display}</span>
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-sm bg-bg-subtle px-2 text-xs uppercase tracking-[0.14em] text-fg-muted">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full min-w-0 bg-transparent font-mono text-sm normal-case tracking-normal text-fg"
      />
    </label>
  );
}

async function snapshotDoc(doc: EditorDoc, fontFamily: string, kind: "png" | "jpg"): Promise<Blob> {
  const { width, height } = doc.artboard;
  const canvas = document.createElement("canvas");
  const outScale = Math.min(2, 4096 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * outScale));
  canvas.height = Math.max(1, Math.round(height * outScale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.scale(outScale, outScale);
  ctx.fillStyle = doc.artboard.bg;
  ctx.fillRect(0, 0, width, height);
  if (doc.artboard.paper !== "solid") {
    const g =
      doc.artboard.paper === "radial"
        ? ctx.createRadialGradient(width * 0.28, height * 0.22, 8, width * 0.5, height * 0.5, Math.max(width, height))
        : ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, doc.artboard.bg);
    g.addColorStop(1, doc.artboard.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  for (const layer of doc.layers) {
    if (layer.hidden) continue;
    const box = layerBox(layer);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = canvasBlend(layer.blend);
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    applyLayerDepth(ctx, layer);
    if (layer.type === "text") {
      ctx.font = `${layer.fontSize}px ${fontFamily}`;
      ctx.textAlign = layer.align === "center" ? "center" : layer.align === "right" ? "right" : "left";
      ctx.textBaseline = "top";
      const lines = displayText(layer).split("\n");
      const origin = layer.align === "center" ? 0 : layer.align === "right" ? box.w / 2 : -box.w / 2;
      const paint = (fill: string, dx: number, dy: number) => {
        ctx.fillStyle = fill;
        lines.forEach((line, i) => {
          ctx.fillText(line, origin + dx, -box.h / 2 + i * layer.fontSize * layer.leading + dy, box.w);
        });
      };
      if (layer.extrude > 0) {
        const steps = Math.min(40, Math.round(layer.extrude));
        const rx = (layer.rotateX * Math.PI) / 180;
        const ry = (layer.rotateY * Math.PI) / 180;
        for (let i = steps; i >= 1; i -= 1) {
          paint(mixHex(layer.fill, "#050505", 0.32 + (i / steps) * 0.48), Math.sin(ry) * i + i * 0.22, -Math.sin(rx) * i + i * 0.55);
        }
      }
      if (layer.shadowBlur || layer.shadowX || layer.shadowY) {
        ctx.shadowOffsetX = layer.shadowX;
        ctx.shadowOffsetY = layer.shadowY;
        ctx.shadowBlur = layer.shadowBlur;
        ctx.shadowColor = layer.shadowColor;
      }
      paint(layer.fill, 0, 0);
      ctx.shadowColor = "transparent";
    } else if (layer.type === "rect" || layer.type === "ellipse") {
      ctx.fillStyle = layer.fill;
      if (layer.shadowBlur || layer.shadowX || layer.shadowY) {
        ctx.shadowOffsetX = layer.shadowX;
        ctx.shadowOffsetY = layer.shadowY;
        ctx.shadowBlur = layer.shadowBlur;
        ctx.shadowColor = layer.shadowColor;
      }
      ctx.beginPath();
      if (layer.type === "ellipse") ctx.ellipse(0, 0, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2);
      else {
        const r = Math.min(layer.radius, layer.w / 2, layer.h / 2);
        roundRect(ctx, -layer.w / 2, -layer.h / 2, layer.w, layer.h, r);
      }
      ctx.fill();
      if (layer.strokeWidth > 0) {
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth;
        ctx.stroke();
      }
    } else if (layer.type === "image" && layer.src) {
      const img = await loadImg(layer.src);
      ctx.filter = imageFilter(layer);
      ctx.drawImage(img, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
      ctx.filter = "none";
    }
    ctx.restore();
  }
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, kind === "jpg" ? "image/jpeg" : "image/png", 0.95),
  );
  if (!out) throw new Error("Could not encode image");
  return out;
}

function applyLayerDepth(ctx: CanvasRenderingContext2D, layer: Layer) {
  const rx = (layer.rotateX * Math.PI) / 180;
  const ry = (layer.rotateY * Math.PI) / 180;
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.transform(1, Math.tan(rx) * 0.18, Math.tan(ry) * 0.18, 1, 0, layer.translateZ * -0.04);
  const sx = Math.max(0.18, Math.abs(Math.cos(ry))) * (layer.flipX ? -1 : 1);
  const sy = Math.max(0.18, Math.abs(Math.cos(rx))) * (layer.flipY ? -1 : 1);
  ctx.scale(sx, sy);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read placed image"));
    img.src = url;
  });
}

function serializeBoardSvg(doc: EditorDoc, fontFamily: string): string {
  const { artboard } = doc;
  const bg = paperBackground(artboard.bg, artboard.bg2, artboard.paper, artboard.angle, "none");
  const layers = doc.layers
    .filter((l) => !l.hidden)
    .map((layer) => {
      const box = layerBox(layer);
      const origin = `transform="rotate(${layer.rotation} ${box.x + box.w / 2} ${box.y + box.h / 2}) scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})"`;
      if (layer.type === "text") {
        const fill = layer.ink === "solid" ? layer.fill : layer.fill;
        const text = escapeXml(displayText(layer));
        return `<text x="${layer.x}" y="${layer.y + layer.fontSize}" fill="${fill}" font-size="${layer.fontSize}" font-family="${escapeXml(fontFamily)}" letter-spacing="${layer.tracking}em" opacity="${layer.opacity}">${text}</text>`;
      }
      if (layer.type === "ellipse") {
        return `<ellipse cx="${layer.x + layer.w / 2}" cy="${layer.y + layer.h / 2}" rx="${layer.w / 2}" ry="${layer.h / 2}" fill="${layer.fill}" opacity="${layer.opacity}" ${origin}/>`;
      }
      if (layer.type === "rect") {
        return `<rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}" rx="${layer.radius}" fill="${layer.fill}" opacity="${layer.opacity}" ${origin}/>`;
      }
      if (layer.type !== "image") return "";
      return `<image href="${escapeXml(layer.src)}" x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}" opacity="${layer.opacity}" ${origin}/>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${artboard.width}" height="${artboard.height}" viewBox="0 0 ${artboard.width} ${artboard.height}"><rect width="100%" height="100%" fill="${bg.backgroundColor}"/>${layers}</svg>\n`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&#38;";
    if (ch === "<") return "&#60;";
    if (ch === ">") return "&#62;";
    if (ch === '"') return "&#34;";
    return "&#39;";
  });
}
