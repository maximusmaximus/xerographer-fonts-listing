import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Download,
  Dices,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ColorWheel } from "@/components/color-wheel";
import { Dial } from "@/components/dial";
import { ShareComposition } from "@/components/share-composition";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { compositionHref, serializeComposition } from "@/lib/font-search";
import { applyCase, fileStem, SAMPLE_COPY, type Align, type CaseMode } from "@/lib/specimen.ts";
import { downloadBlob, outlineSpecimen, rasterizeSpecimen, type SpecimenStyle } from "@/lib/specimen-render.ts";
import {
  ATMOSPHERES,
  INK_MODES,
  PAPER_MODES,
  TEXTURES,
  inkCss,
  paperBackground,
  type Atmosphere,
  type InkMode,
  type PaperMode,
  type TextureId,
} from "@/lib/surfaces";
import { cn } from "@/lib/utils";

const DEFAULT_BG = ATMOSPHERES[0]!.bg;
const DEFAULT_FG = ATMOSPHERES[0]!.fg;

type StudioTab = "paper" | "ink" | "type";

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
  initialAlign?: Align;
  initialTrack?: number;
  initialLead?: number;
  initialCase?: CaseMode;
  initialFg2?: string;
  initialBg2?: string;
  initialPaper?: PaperMode;
  initialInk?: InkMode;
  initialTexture?: TextureId;
  initialAngle?: number;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLParagraphElement>(null);
  const navigate = useNavigate({ from: "/font/$slug" });
  const seededText = initialText?.trim() || name;
  const [text, setText] = useState(seededText);
  const [size, setSize] = useState(initialSize ?? 72);
  const [bg, setBg] = useState<string>(initialBg ?? DEFAULT_BG);
  const [bg2, setBg2] = useState<string>(initialBg2 ?? "#2a2722");
  const [fg, setFg] = useState<string>(initialFg ?? DEFAULT_FG);
  const [fg2, setFg2] = useState<string>(initialFg2 ?? "#cfc6b4");
  const [paper, setPaper] = useState<PaperMode>(initialPaper ?? "solid");
  const [ink, setInk] = useState<InkMode>(initialInk ?? "solid");
  const [texture, setTexture] = useState<TextureId>(initialTexture ?? "grain");
  const [angle, setAngle] = useState(initialAngle ?? 160);
  const [align, setAlign] = useState<Align>(initialAlign ?? "left");
  const [tracking, setTracking] = useState(initialTrack ?? 0);
  const [leading, setLeading] = useState(initialLead ?? 1.15);
  const [caseMode, setCaseMode] = useState<CaseMode>(initialCase ?? "none");
  const [tab, setTab] = useState<StudioTab>("paper");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"svg" | "jpg" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

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

  const composition = {
    text,
    size,
    fg,
    bg,
    fg2,
    bg2,
    align,
    track: tracking,
    lead: leading,
    case: caseMode,
    paper,
    ink,
    tx: texture,
    ang: angle,
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void navigate({
        params: { slug },
        search: serializeComposition(composition),
        replace: true,
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [align, angle, bg, bg2, caseMode, fg, fg2, ink, leading, navigate, paper, size, slug, text, texture, tracking]);

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
      bg2,
      fg,
      fg2,
      paper,
      ink,
      texture,
      angle,
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

  function stamp() {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 280);
  }

  function applyAtmosphere(look: Atmosphere) {
    setBg(look.bg);
    setBg2(look.bg2);
    setFg(look.fg);
    setFg2(look.fg2);
    setPaper(look.paper);
    setInk(look.ink);
    setTexture(look.texture);
    setAngle(look.angle);
    stamp();
  }

  function shuffle() {
    const look = ATMOSPHERES[Math.floor(Math.random() * ATMOSPHERES.length)]!;
    applyAtmosphere(look);
  }

  function reset() {
    setText(seededText);
    setSize(initialSize ?? 72);
    setBg(initialBg ?? DEFAULT_BG);
    setBg2(initialBg2 ?? "#2a2722");
    setFg(initialFg ?? DEFAULT_FG);
    setFg2(initialFg2 ?? "#cfc6b4");
    setPaper(initialPaper ?? "solid");
    setInk(initialInk ?? "solid");
    setTexture(initialTexture ?? "grain");
    setAngle(initialAngle ?? 160);
    setAlign(initialAlign ?? "left");
    setTracking(initialTrack ?? 0);
    setLeading(initialLead ?? 1.15);
    setCaseMode(initialCase ?? "none");
    setNote(null);
  }

  const display = applyCase(text, caseMode);
  const paperCss = paperBackground(bg, bg2, paper, angle, texture);
  const typeCss = inkCss(fg, fg2, ink, angle);

  return (
    <div className="min-w-0 overflow-x-hidden rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)] sm:p-6">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Preview text"
        rows={2}
        placeholder="Type a line. Watch it set."
        className="min-h-16 bg-bg-subtle"
      />

      <div
        ref={stageRef}
        className={cn("playground-stage relative mt-3 overflow-hidden rounded-lg p-5 sm:p-8", pulse && "studio-stamp")}
        style={paperCss as CSSProperties}
      >
        <p
          ref={copyRef}
          data-specimen
          className="relative break-words"
          style={{
            fontFamily: ready ? `xf-${slug}, var(--font-display)` : "var(--font-display)",
            fontSize: `clamp(1.5rem, ${size / 16}rem, 5.5rem)`,
            lineHeight: leading,
            letterSpacing: `${tracking}em`,
            textAlign: align,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            ...typeCss,
          }}
        >
          {display || "Type something"}
        </p>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto">
        {(["paper", "ink", "type"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-sm capitalize transition-colors duration-150 ease-out",
              tab === key ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg-muted hover:text-fg",
            )}
          >
            {key === "paper" ? "Paper" : key === "ink" ? "Ink" : "Type"}
          </button>
        ))}
      </div>

      {tab === "paper" ? (
        <div className="mt-4 space-y-4">
          <ModeRow
            options={PAPER_MODES}
            value={paper}
            onChange={setPaper}
          />
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-8">
            <ColorWheel label="Paper" value={bg} onChange={setBg} size={140} />
            {paper !== "solid" ? <ColorWheel label="Wash" value={bg2} onChange={setBg2} size={140} /> : null}
          </div>
          {paper !== "solid" ? (
            <RangeStrip label="Angle" min={0} max={360} step={1} value={angle} onChange={setAngle} display={`${angle}°`} />
          ) : null}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-fg-muted">Tooth</p>
            <div className="flex flex-wrap gap-2">
              {TEXTURES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={texture === item.id}
                  onClick={() => {
                    setTexture(item.id);
                    stamp();
                  }}
                  className={cn(
                    "flex size-14 flex-col items-center justify-center rounded-full text-[10px] uppercase tracking-[0.12em] transition-transform duration-150 ease-out",
                    texture === item.id ? "scale-105 shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-[var(--shadow-border)]",
                  )}
                  style={paperBackground(bg, bg2, paper, angle, item.id) as CSSProperties}
                >
                  <span className="rounded-full bg-bg/70 px-1.5 text-fg">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "ink" ? (
        <div className="mt-4 space-y-4">
          <ModeRow options={INK_MODES} value={ink} onChange={setInk} />
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-8">
            <ColorWheel label="Ink" value={fg} onChange={setFg} size={140} />
            {ink !== "solid" ? <ColorWheel label="Fade" value={fg2} onChange={setFg2} size={140} /> : null}
          </div>
          {ink !== "solid" ? (
            <RangeStrip label="Angle" min={0} max={360} step={1} value={angle} onChange={setAngle} display={`${angle}°`} />
          ) : null}
        </div>
      ) : null}

      {tab === "type" ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap justify-center gap-6">
            <Dial label="Size" min={28} max={160} step={1} value={size} onChange={setSize} display={`${size}`} />
            <Dial
              label="Track"
              min={-0.08}
              max={0.28}
              step={0.01}
              value={tracking}
              onChange={setTracking}
              display={tracking.toFixed(2)}
            />
            <Dial
              label="Lead"
              min={0.9}
              max={2}
              step={0.05}
              value={leading}
              onChange={setLeading}
              display={leading.toFixed(2)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>
      ) : null}

      <div className="mt-5">
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-fg-muted">Atmospheres</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ATMOSPHERES.map((look) => (
            <button
              key={look.id}
              type="button"
              aria-label={look.name}
              onClick={() => applyAtmosphere(look)}
              className="flex size-14 shrink-0 items-end justify-center rounded-full pb-1 text-[10px] uppercase tracking-[0.12em] text-fg transition-transform duration-150 ease-out hover:scale-105"
              style={paperBackground(look.bg, look.bg2, look.paper, look.angle, look.texture) as CSSProperties}
            >
              <span className="rounded-full bg-bg/70 px-1.5">{look.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setText(SAMPLE_COPY)}>
          Sample copy
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={shuffle}>
          <Dices className="size-4" />
          Shuffle
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <ShareComposition
          url={compositionHref(`/font/${slug}`, composition)}
          title={`${name}: ${text.trim() || name}`}
        />
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
            "h-11 rounded-full px-4 text-sm transition-colors duration-150 ease-out",
            value === option.id ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
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
        "inline-flex size-11 items-center justify-center rounded-full transition-colors duration-150 ease-out",
        pressed ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg hover:bg-bg-elevated",
      )}
    >
      {children}
    </button>
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
