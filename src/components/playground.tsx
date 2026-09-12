import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Download,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { applyCase, fileStem, LOOKS, SAMPLE_COPY, type Align, type CaseMode } from "@/lib/specimen.ts";
import { downloadBlob, outlineSpecimen, rasterizeSpecimen, type SpecimenStyle } from "@/lib/specimen-render.ts";
import { cn } from "@/lib/utils";

const DEFAULT_BG = LOOKS[0].bg;
const DEFAULT_FG = LOOKS[0].fg;

export function FontPlayground({
  slug,
  name,
  initialText,
  initialSize,
}: {
  slug: string;
  name: string;
  initialText?: string;
  initialSize?: number;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLParagraphElement>(null);
  const seededText = initialText?.trim() || name;
  const [text, setText] = useState(seededText);
  const [size, setSize] = useState(initialSize ?? 72);
  const [bg, setBg] = useState<string>(DEFAULT_BG);
  const [fg, setFg] = useState<string>(DEFAULT_FG);
  const [align, setAlign] = useState<Align>("left");
  const [tracking, setTracking] = useState(0);
  const [leading, setLeading] = useState(1.15);
  const [caseMode, setCaseMode] = useState<CaseMode>("none");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"svg" | "jpg" | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

  function metrics(): SpecimenStyle {
    const stage = stageRef.current;
    const copy = copyRef.current;
    const stageCss = stage ? getComputedStyle(stage) : null;
    const copyCss = copy ? getComputedStyle(copy) : null;
    const fontSize = copyCss ? parseFloat(copyCss.fontSize) : size;
    const parsedLeading = copyCss ? parseFloat(copyCss.lineHeight) : NaN;
    const trackingPx = copyCss && copyCss.letterSpacing !== "normal" ? parseFloat(copyCss.letterSpacing) : tracking * fontSize;
    return {
      text: text.trim() ? text : name,
      caseMode,
      align,
      fontSize,
      trackingPx: Number.isFinite(trackingPx) ? trackingPx : 0,
      lineHeight: Number.isFinite(parsedLeading) ? parsedLeading : fontSize * leading,
      width: stage?.clientWidth || 720,
      padX: stageCss ? parseFloat(stageCss.paddingLeft) || 32 : 32,
      padY: stageCss ? parseFloat(stageCss.paddingTop) || 32 : 32,
      bg,
      fg,
      fontFamily: `xf-${slug}, sans-serif`,
    };
  }

  async function exportSvg() {
    setBusy("svg");
    setNote(null);
    try {
      const res = await fetch(`/api/font-file/${slug}`);
      if (!res.ok) throw new Error("Font file unavailable");
      const svg = outlineSpecimen(await res.arrayBuffer(), metrics());
      downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileStem(slug)}.svg`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not export SVG");
    } finally {
      setBusy(null);
    }
  }

  async function exportJpg() {
    setBusy("jpg");
    setNote(null);
    try {
      const blob = await rasterizeSpecimen(metrics());
      downloadBlob(blob, `${fileStem(slug)}.jpg`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not export JPEG");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setText(seededText);
    setSize(72);
    setBg(DEFAULT_BG);
    setFg(DEFAULT_FG);
    setAlign("left");
    setTracking(0);
    setLeading(1.15);
    setCaseMode("none");
    setNote(null);
  }

  const display = applyCase(text, caseMode);

  return (
    <div className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)] sm:p-6">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Preview text"
        rows={2}
        placeholder="Type to proof this face…"
        className="min-h-16 bg-bg-subtle"
      />

      <div
        ref={stageRef}
        className="mt-3 min-h-48 overflow-hidden rounded-lg p-5 sm:min-h-64 sm:p-8"
        style={{ background: bg, color: fg }}
      >
        <p
          ref={copyRef}
          data-specimen
          className="break-words"
          style={{
            fontFamily: ready ? `xf-${slug}, var(--font-display)` : "var(--font-display)",
            fontSize: `clamp(1.5rem, ${size / 16}rem, 7rem)`,
            lineHeight: leading,
            letterSpacing: `${tracking}em`,
            textAlign: align,
            whiteSpace: "pre-wrap",
          }}
        >
          {display || "Type something"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ToolGroup label="Align">
          <Tool pressed={align === "left"} label="Align left" onClick={() => setAlign("left")}>
            <AlignLeft className="size-4" />
          </Tool>
          <Tool pressed={align === "center"} label="Align center" onClick={() => setAlign("center")}>
            <AlignCenter className="size-4" />
          </Tool>
          <Tool pressed={align === "right"} label="Align right" onClick={() => setAlign("right")}>
            <AlignRight className="size-4" />
          </Tool>
          <Tool pressed={align === "justify"} label="Justify" onClick={() => setAlign("justify")}>
            <AlignJustify className="size-4" />
          </Tool>
        </ToolGroup>
        <ToolGroup label="Case">
          <Tool pressed={caseMode === "none"} label="As typed" onClick={() => setCaseMode("none")}>
            <CaseSensitive className="size-4" />
          </Tool>
          <Tool pressed={caseMode === "upper"} label="Uppercase" onClick={() => setCaseMode("upper")}>
            <CaseUpper className="size-4" />
          </Tool>
          <Tool pressed={caseMode === "lower"} label="Lowercase" onClick={() => setCaseMode("lower")}>
            <CaseLower className="size-4" />
          </Tool>
        </ToolGroup>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ColorField label="Window" value={bg} onChange={setBg} />
        <ColorField label="Text" value={fg} onChange={setFg} />
        <ToolGroup label="Looks">
          {LOOKS.map((look) => (
            <button
              key={look.name}
              type="button"
              aria-label={look.name}
              onClick={() => {
                setBg(look.bg);
                setFg(look.fg);
              }}
              className={cn(
                "size-11 rounded-sm shadow-[var(--shadow-border)]",
                bg === look.bg && fg === look.fg ? "outline-2 outline-offset-2 outline-accent" : "",
              )}
              style={{ background: look.bg }}
            >
              <span className="mx-auto block h-3 w-5 rounded-full" style={{ background: look.fg }} />
            </button>
          ))}
        </ToolGroup>
        <Button type="button" variant="secondary" size="sm" onClick={() => { const next = bg; setBg(fg); setFg(next); }}>
          <ArrowLeftRight className="size-4" />
          Swap
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RangeField label="Size" min={28} max={160} step={1} value={size} onChange={setSize} display={`${size}`} />
        <RangeField
          label="Track"
          min={-0.08}
          max={0.28}
          step={0.01}
          value={tracking}
          onChange={setTracking}
          display={tracking.toFixed(2)}
        />
        <RangeField
          label="Lead"
          min={0.9}
          max={2}
          step={0.05}
          value={leading}
          onChange={setLeading}
          display={leading.toFixed(2)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setText(SAMPLE_COPY)}>
          Sample copy
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void exportSvg()}>
          <Download className="size-4" />
          {busy === "svg" ? "Saving SVG…" : "Download SVG"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void exportJpg()}>
          <Download className="size-4" />
          {busy === "jpg" ? "Saving JPG…" : "Download JPG"}
        </Button>
      </div>
      {note ? <p className="mt-3 text-sm text-fg-muted">{note}</p> : null}
    </div>
  );
}

function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs uppercase tracking-[0.16em] text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

function Tool({
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
        "inline-flex size-11 items-center justify-center rounded-sm transition-colors duration-150 ease-out",
        pressed ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg hover:bg-bg-elevated",
      )}
    >
      {children}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-16 text-xs uppercase tracking-[0.16em] text-fg-muted">{label}</span>
      <span
        className="relative size-11 overflow-hidden rounded-sm shadow-[var(--shadow-border)]"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
        />
      </span>
      <span className="hidden font-mono text-xs tabular-nums text-fg-muted sm:inline">{value}</span>
    </label>
  );
}

function RangeField({
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
      <span className="w-12 shrink-0">{label}</span>
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
