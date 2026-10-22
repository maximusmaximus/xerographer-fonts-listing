/**
 * Specimen Ledger promo pop-up rules (pure, testable).
 * Re-show policy: after a visitor dismisses it, it stays hidden for 3 days (localStorage),
 * and it never shows more than once per browser session (sessionStorage), even if
 * localStorage is unavailable.
 */
export const PROMO_STORAGE_KEY = "xf.bookPromo.dismissedAt";
export const PROMO_SESSION_KEY = "xf.bookPromo.shownThisSession";
export const PROMO_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/** Routes where the pop-up must never appear: the book page itself, checkout/order flow, admin. */
const BLOCKED = [/^\/book(\/|$)/, /^\/book_/, /^\/order(\/|$)/, /^\/admin(\/|\.|$)/, /^\/api(\/|$)/, /^\/license(\/|$)/];

export function promoAllowedOnPath(pathname: string): boolean {
  return !BLOCKED.some((re) => re.test(pathname));
}

export function shouldShowPromo(args: {
  pathname: string;
  now: number;
  dismissedAt: string | null;
  shownThisSession: boolean;
}): boolean {
  if (!promoAllowedOnPath(args.pathname)) return false;
  if (args.shownThisSession) return false;
  const t = args.dismissedAt ? Number(args.dismissedAt) : NaN;
  if (Number.isFinite(t) && args.now - t < PROMO_SNOOZE_MS && args.now >= t) return false;
  return true;
}

export const PROMO_PAGES = [
  { file: "01-cover", alt: "Front cover: layered fluorescent type with “Max Infeld”" },
  { file: "02-p001", alt: "Title page: 1376 font Specimen Ledger by Xerographer Fonts" },
  { file: "03-p003", alt: "Index page listing typefaces" },
  { file: "04-p012", alt: "Specimen page: Aircraft, Adjournment, Impressionists in a heavy display face" },
  { file: "05-p020", alt: "Specimen spread of four faces: Blinkers, Banner, Sparkled, Shadow" },
  { file: "06-p090", alt: "Specimen page of outline and stencil faces" },
  { file: "07-p180", alt: "Specimen page: Unbound, Achieving, Printer, Romanov" },
  { file: "08-p270", alt: "Specimen page of handwritten script faces" },
  { file: "09-p525", alt: "Art page: a large X over radiating rainbow type" },
  { file: "10-p530", alt: "Closing art page: Xerographer 2026" },
] as const;

export const promoSrc = (file: string, size: 640 | 1200) => `/book/preview/${file}-${size}.webp`;

export function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n;
}

export const SWIPE_THRESHOLD_PX = 40;

/** +1 = next page, -1 = previous, 0 = not a horizontal swipe. */
export function swipeDirection(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
