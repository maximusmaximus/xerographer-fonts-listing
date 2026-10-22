import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { PROMO_PAGES, promoSrc, swipeDirection, wrapIndex } from "@/lib/book-promo";

export function BookPreview() {
  const [index, setIndex] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const n = PROMO_PAGES.length;
  const page = PROMO_PAGES[index]!;

  function go(d: number) {
    setIndex((i) => wrapIndex(i + d, n));
  }

  function onDown(e: RPointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
  }
  function onUp(e: RPointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const d = swipeDirection(e.clientX - s.x, e.clientY - s.y);
    if (d) go(d);
  }

  return (
    <figure className="min-w-0">
      <div
        className="relative aspect-square overflow-hidden rounded-lg border border-border bg-bg-subtle"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => {
          start.current = null;
        }}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Book preview, ${index + 1} of ${n}`}
      >
        <img
          key={page.file}
          src={promoSrc(page.file, 1200)}
          srcSet={`${promoSrc(page.file, 640)} 640w, ${promoSrc(page.file, 1200)} 1200w`}
          sizes="(min-width: 1024px) 480px, 100vw"
          alt={page.alt}
          width={1200}
          height={1200}
          decoding="async"
          draggable={false}
          className="h-full w-full object-contain"
        />
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous page"
          className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-fg shadow"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next page"
          className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-bg/80 text-fg shadow"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <figcaption className="mt-2 text-sm text-fg-muted">
        <span className="font-mono tabular-nums text-fg">
          {index + 1}/{n}
        </span>{" "}
        {page.alt}
      </figcaption>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Sample pages">
        {PROMO_PAGES.map((p, i) => (
          <button
            key={p.file}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={p.alt}
            aria-current={i === index ? "true" : undefined}
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-sm border ${i === index ? "border-fg" : "border-border opacity-70"}`}
          >
            <img src={promoSrc(p.file, 640)} alt="" width={64} height={64} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </figure>
  );
}
