import { useRouterState } from "@tanstack/react-router";
import { Info, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  currentTourStep,
  guideRouteFromPath,
  HINTS,
  TOURS,
  useGuide,
  type HintId,
} from "@/lib/guide";
import { cn } from "@/lib/utils";

export function GuideProvider({ children }: { children: ReactNode }) {
  const hydrate = useGuide((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return (
    <>
      {children}
      <TourLayer />
    </>
  );
}

export function GuideToggle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const route = guideRouteFromPath(pathname);
  const hintsOn = useGuide((s) => s.hintsOn);
  const tourRoute = useGuide((s) => s.tourRoute);
  const toggle = useGuide((s) => s.toggle);
  const active = hintsOn || tourRoute === route;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={active ? "Hide feature guides" : "Walk through the site"}
      aria-pressed={active}
      onClick={() => toggle(route)}
      className={cn("size-11 px-0", active ? "text-fg" : "")}
    >
      <Info className="size-4" />
    </Button>
  );
}

export function HintSpot({
  id,
  children,
  className,
  badge = "right",
}: {
  id: HintId;
  children: ReactNode;
  className?: string;
  badge?: "right" | "left";
}) {
  const hintsOn = useGuide((s) => s.hintsOn);
  const openHint = useGuide((s) => s.openHint);
  const setOpenHint = useGuide((s) => s.setOpenHint);
  const tourRoute = useGuide((s) => s.tourRoute);
  const tourIndex = useGuide((s) => s.tourIndex);
  const hint = HINTS[id];
  const step = currentTourStep(tourRoute, tourIndex);
  const touring = step?.id === id;
  const open = openHint === id;
  const panelId = useId();

  if (!hintsOn && !touring) {
    return (
      <div className={className} data-hint={id}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} data-hint={id}>
      {children}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`About ${hint.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpenHint(open ? null : id);
        }}
        className={cn(
          "hint-badge absolute z-30 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-fg shadow-[var(--shadow-border)]",
          badge === "left" ? "left-1 top-1" : "right-1 top-1",
          touring ? "ring-2 ring-fg" : "",
        )}
      >
        i
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          className={cn(
            "absolute z-40 mt-1 w-64 rounded-xl bg-bg-elevated p-3 text-left shadow-[var(--shadow-border)]",
            badge === "left" ? "left-0" : "right-0",
          )}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-fg-muted">{hint.title}</p>
          <p className="mt-2 text-sm text-fg">{hint.body}</p>
          <button
            type="button"
            className="mt-2 text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            onClick={() => setOpenHint(null)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TourLayer() {
  const tourRoute = useGuide((s) => s.tourRoute);
  const tourIndex = useGuide((s) => s.tourIndex);
  const next = useGuide((s) => s.next);
  const back = useGuide((s) => s.back);
  const skipTour = useGuide((s) => s.skipTour);
  const step = currentTourStep(tourRoute, tourIndex);
  const [box, setBox] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!step) {
      setBox(null);
      return;
    }
    const el = document.querySelector(`[data-hint="${step.id}"]`);
    if (!(el instanceof HTMLElement)) {
      setBox(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setBox(el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipTour();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, next, back, skipTour]);

  if (!step || tourRoute == null || tourIndex == null) return null;
  const total = TOURS[tourRoute].length;
  const last = tourIndex >= total - 1;
  const pad = 8;
  const highlight = box
    ? {
        top: Math.max(8, box.top - pad),
        left: Math.max(8, box.left - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      }
    : null;

  const cardTop = highlight
    ? Math.min(window.innerHeight - 220, Math.max(16, highlight.top + highlight.height + 12))
    : 24;
  const cardLeft = highlight ? Math.min(window.innerWidth - 320, Math.max(16, highlight.left)) : 16;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {highlight ? (
        <div
          className="tour-ring pointer-events-none absolute rounded-xl"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : null}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="pointer-events-auto absolute w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-start justify-between gap-3">
          <p id="tour-title" className="font-display text-xl text-fg">
            {step.title}
          </p>
          <button
            type="button"
            aria-label="Skip walkthrough"
            onClick={skipTour}
            className="flex size-11 items-center justify-center rounded-sm text-fg-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-fg-muted">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="font-mono text-xs tabular-nums text-fg-subtle">
            {tourIndex + 1} / {total}
          </p>
          <div className="flex gap-2">
            {tourIndex > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={back}>
                Back
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={next}>
              {last ? "Got it" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
