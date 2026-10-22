/**
 * Specimen Ledger promo modal. Shown once on arrival (rules in lib/book-promo.ts),
 * docks into the header's "Specimen Book" tab when closed.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  PROMO_PAGES, PROMO_SESSION_KEY, PROMO_STORAGE_KEY, promoSrc, shouldShowPromo, wrapIndex,
} from "@/lib/book-promo";
import { fetchStoreStatus } from "@/lib/store-status";

function store(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function BookPromo() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const n = PROMO_PAGES.length;

  // Decide once per mount whether to show.
  useEffect(() => {
    const show = shouldShowPromo({
      pathname,
      now: Date.now(),
      dismissedAt: store("local")?.getItem(PROMO_STORAGE_KEY) ?? null,
      shownThisSession: store("session")?.getItem(PROMO_SESSION_KEY) === "1",
    });
    if (!show) return;
    const t = window.setTimeout(() => {
      store("session")?.setItem(PROMO_SESSION_KEY, "1");
      lastFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close if the visitor navigates to a blocked route (e.g. /book).
  useEffect(() => {
    if (open && /^\/(book|order|admin)/.test(pathname)) setOpen(false);
  }, [pathname, open]);

  useEffect(() => {
    if (!open) return;
    void fetchStoreStatus().then((s) => setLeft(typeof s.editionLeft === "number" ? s.editionLeft : null));
  }, [open]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    store("local")?.setItem(PROMO_STORAGE_KEY, String(Date.now()));
    const panel = dialogRef.current;
    const tab = document.querySelector<HTMLElement>("[data-book-tab]");
    const done = () => {
      closingRef.current = false;
      setOpen(false);
      (tab ?? lastFocus.current)?.focus?.();
      tab?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 320 });
    };
    if (!panel || !tab || reducedMotion() || !panel.animate) return done();
    const a = panel.getBoundingClientRect();
    const b = tab.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = Math.max(0.04, b.width / a.width);
    const anim = panel.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1, borderRadius: "16px" },
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.2, borderRadius: "40px" },
      ],
      { duration: 460, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" },
    );
    anim.onfinish = done;
  }, []);

  const go = useCallback((d: number) => setIndex((i) => wrapIndex(i + d, n)), [n]);

  // Keyboard: Esc closes, arrows move, Tab is trapped.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const f = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!dialogRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, close, go]);

  // Swipe.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: RPointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: RPointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  if (!open) return null;
  const page = PROMO_PAGES[index];
  const motion = reducedMotion() ? "" : "animate-[promo-in_.28s_ease-out]";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-6"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
      data-testid="book-promo-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative flex w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-bg-elevated text-fg shadow-2xl sm:max-w-[min(920px,100%)] sm:rounded-2xl md:flex-row ${motion}`}
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top) - 8px)", height: "auto" }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-bg/80 text-fg-muted backdrop-blur hover:text-fg"
        >
          <X className="size-5" aria-hidden />
        </button>

        {/* Carousel */}
        <div className="relative shrink md:w-[55%] md:shrink-0">
          <div
            className="relative mx-auto aspect-square w-full max-h-[52dvh] touch-pan-y select-none bg-bg-subtle md:max-h-[min(640px,80dvh)]"
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={() => (start.current = null)}
            role="group"
            aria-roledescription="carousel"
            aria-label={`Sample pages, ${index + 1} of ${n}`}
          >
            <img
              key={page.file}
              src={promoSrc(page.file, 1200)}
              srcSet={`${promoSrc(page.file, 640)} 640w, ${promoSrc(page.file, 1200)} 1200w`}
              sizes="(min-width: 768px) 500px, 100vw"
              alt={page.alt}
              width={1200}
              height={1200}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className="mx-auto h-full w-auto max-w-full object-contain"
            />
            {/* Prefetch the neighbours cheaply. */}
            <link rel="prefetch" href={promoSrc(PROMO_PAGES[wrapIndex(index + 1, n)].file, 640)} />
            <button type="button" onClick={() => go(-1)} aria-label="Previous page"
              className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-fg shadow sm:inline-flex">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next page"
              className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-fg shadow sm:inline-flex">
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-2" aria-live="polite">
            {PROMO_PAGES.map((p, i) => (
              <button
                key={p.file}
                type="button"
                tabIndex={-1}
                aria-label={`Page ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-fg" : "w-1.5 bg-fg-subtle"}`}
              />
            ))}
            <span className="ml-2 font-mono text-xs tabular-nums text-fg-muted">{index + 1}/{n}</span>
          </div>
        </div>

        {/* Copy + CTA */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 sm:px-6 md:pt-10">
            <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">The book</p>
            <h2 id={titleId} className="mt-1 font-display text-2xl sm:text-3xl">Xerographer Specimen Ledger</h2>
            <p id={descId} className="mt-2 text-sm text-fg-muted">
              All 1,376 Xerographer typefaces in one 530-page hardcover, 11.75 × 11.75 in, full color on 100# gloss.
            </p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-3xl">$250</span>
              <span className="text-xs text-fg-muted">plus shipping and sales tax</span>
            </p>
            <p className="mt-2 text-sm font-medium" data-testid="promo-edition">
              Limited edition: only 500 copies{left !== null ? ` · ${left} remaining` : ""}
            </p>
            <p className="mt-3 hidden text-sm text-fg-muted sm:block">Swipe through ten sample pages, from the cover to the closing art.</p>
            <p className="mt-2 text-sm text-fg-muted sm:hidden">Swipe through ten sample pages.</p>
          </div>
          <div className="border-t border-border bg-bg-elevated px-5 py-3 sm:px-6 md:border-0 md:pb-8"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <Button asChild size="lg" className="w-full">
              <Link to="/book" data-autofocus onClick={() => store("local")?.setItem(PROMO_STORAGE_KEY, String(Date.now()))}>
                BUY NOW
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
