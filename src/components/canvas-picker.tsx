import { Repeat2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ARTBOARD_GROUPS,
  ARTBOARDS,
  artboardOrientation,
  clampArtboard,
  formatRatio,
  matchArtboard,
  type ArtboardGroupId,
  type ArtboardPreset,
} from "@/lib/editor";
import { cn } from "@/lib/utils";

export function CanvasThumb({
  width,
  height,
  active = false,
  className,
}: {
  width: number;
  height: number;
  active?: boolean;
  className?: string;
}) {
  const maxW = 36;
  const maxH = 24;
  const s = Math.min(maxW / Math.max(1, width), maxH / Math.max(1, height));
  return (
    <span
      className={cn(
        "grid size-11 place-items-center rounded-sm bg-bg-subtle",
        active ? "shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-[var(--shadow-border)]",
        className,
      )}
      aria-hidden
    >
      <span
        className="block bg-fg/70"
        style={{ width: Math.max(6, width * s), height: Math.max(6, height * s) }}
      />
    </span>
  );
}

export function CanvasMeta({ width, height }: { width: number; height: number }) {
  const ratio = formatRatio(width, height);
  const orient = artboardOrientation(width, height);
  return (
    <span className="font-mono text-[11px] tabular-nums tracking-normal text-fg-muted">
      {width} × {height}
      <span className="px-1 text-fg-subtle">·</span>
      {ratio}
      <span className="px-1 text-fg-subtle">·</span>
      {orient}
    </span>
  );
}

export function CanvasPicker({
  width,
  height,
  fit,
  onFitChange,
  onPick,
  compact = false,
}: {
  width: number;
  height: number;
  fit: boolean;
  onFitChange: (fit: boolean) => void;
  onPick: (width: number, height: number) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const matched = matchArtboard(width, height);
  const [group, setGroup] = useState<ArtboardGroupId>(matched?.group ?? "standard");
  const [customW, setCustomW] = useState(String(width));
  const [customH, setCustomH] = useState(String(height));
  const [panel, setPanel] = useState({ top: 0, left: 12, width: 360 });
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const place = () => {
      const r = root.current!.getBoundingClientRect();
      const widthPx = Math.min(416, window.innerWidth - 24);
      const left = Math.min(Math.max(12, r.right - widthPx), window.innerWidth - widthPx - 12);
      const estH = Math.min(512, window.innerHeight * 0.7);
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow < estH && r.top > 160
        ? Math.max(12, r.top - estH - 8)
        : Math.min(r.bottom + 6, window.innerHeight - 24);
      setPanel({ top, left, width: widthPx });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    setCustomW(String(width));
    setCustomH(String(height));
  }, [width, height]);

  useEffect(() => {
    if (matched) setGroup(matched.group);
  }, [matched]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!root.current?.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = useMemo(() => ARTBOARDS.filter((item) => item.group === group), [group]);

  function pick(nextW: number, nextH: number) {
    onPick(clampArtboard(nextW), clampArtboard(nextH));
  }

  function applyCustom() {
    pick(Number(customW), Number(customH));
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 max-w-full items-center gap-1.5 rounded-full text-left",
          compact ? "px-1.5" : "px-2 pr-3",
          open ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg hover:bg-bg-elevated",
        )}
      >
        <CanvasThumb width={width} height={height} active={open} className="size-8 rounded-full" />
        {compact ? (
          <span className="hidden min-w-0 pr-1 font-mono text-[10px] tabular-nums opacity-80 sm:block">
            {formatRatio(width, height)}
          </span>
        ) : (
          <span className="min-w-0">
            <span className="block truncate font-mono text-xs tabular-nums">
              {width} × {height}
            </span>
            <span className="block truncate font-mono text-[10px] tabular-nums opacity-70">
              {formatRatio(width, height)} · {artboardOrientation(width, height)}
            </span>
          </span>
        )}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Canvas size"
          className="fixed z-50 max-h-[min(32rem,calc(100vh-6rem))] overflow-y-auto rounded-lg bg-bg-elevated p-3 shadow-[var(--shadow-border)]"
          style={{ top: panel.top, left: panel.left, width: panel.width }}
        >
          <div className="flex gap-1 overflow-x-auto pb-2">
            {ARTBOARD_GROUPS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setGroup(item.id)}
                className={cn(
                  "h-11 shrink-0 rounded-full px-3 text-sm",
                  group === item.id ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg-muted hover:text-fg",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="pb-2 text-xs text-fg-muted">{ARTBOARD_GROUPS.find((g) => g.id === group)?.hint}</p>
          <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <PresetRow
                  item={item}
                  active={width === item.width && height === item.height}
                  onPick={() => pick(item.width, item.height)}
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">Custom</p>
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-sm bg-bg-subtle px-2 text-xs uppercase tracking-[0.14em] text-fg-muted">
                W
                <input
                  type="number"
                  min={320}
                  max={4096}
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  onBlur={applyCustom}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyCustom();
                  }}
                  className="h-11 w-full min-w-0 bg-transparent font-mono text-sm normal-case tracking-normal text-fg"
                />
              </label>
              <span className="text-fg-subtle">×</span>
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-sm bg-bg-subtle px-2 text-xs uppercase tracking-[0.14em] text-fg-muted">
                H
                <input
                  type="number"
                  min={320}
                  max={4096}
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  onBlur={applyCustom}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyCustom();
                  }}
                  className="h-11 w-full min-w-0 bg-transparent font-mono text-sm normal-case tracking-normal text-fg"
                />
              </label>
              <button
                type="button"
                aria-label="Swap orientation"
                onClick={() => pick(height, width)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-fg hover:bg-bg-elevated"
              >
                <Repeat2 className="size-4" />
              </button>
            </div>
            <CanvasMeta width={clampArtboard(Number(customW) || width)} height={clampArtboard(Number(customH) || height)} />
            <label className="flex h-11 items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={fit}
                onChange={(e) => onFitChange(e.target.checked)}
                className="size-4 accent-accent"
              />
              Fit art to the new canvas
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PresetRow({
  item,
  active,
  onPick,
}: {
  item: ArtboardPreset;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left",
        active ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg hover:bg-bg-elevated",
      )}
    >
      <CanvasThumb width={item.width} height={item.height} active={active} className="size-10" />
      <span className="min-w-0">
        <span className="block truncate text-sm">{item.label}</span>
        <span className={cn("block truncate font-mono text-[10px] tabular-nums", active ? "opacity-80" : "text-fg-muted")}>
          {item.width} × {item.height} · {formatRatio(item.width, item.height)} · {artboardOrientation(item.width, item.height)}
        </span>
        <span className={cn("block truncate text-[11px]", active ? "opacity-80" : "text-fg-muted")}>{item.use}</span>
      </span>
    </button>
  );
}
