import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStoreStatus } from "@/lib/store-status";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { BookPreview } from "@/components/book-preview";
import { BOOK_PRODUCT_DEFAULTS, type BookProduct } from "@/lib/product";
import { EDITION_FOR_SALE, EDITION_SIZE } from "@/lib/store/edition";
import { loadBookProduct } from "@/lib/book-product";

export const Route = createFileRoute("/book")({
  loader: () => loadBookProduct(),
  head: () => ({ meta: [{ title: "Xerographer Specimen Ledger — Xerographer Fonts" }] }),
  component: BookPage,
});

const SHIPPING = [
  { id: "standard", name: "Standard", price: "$6.99", time: "Prints in ~4 business days, then 2–5 days" },
  { id: "expedited", name: "Expedited", price: "$30.99", time: "Prints in ~4 business days, then 2 days" },
  { id: "rush", name: "Rush", price: "$35.99", time: "Prints in ~3 business days, then 1 day" },
] as const;

function BookPage() {
  const product = (Route.useLoaderData() ?? BOOK_PRODUCT_DEFAULTS) as BookProduct;
  const status = useStoreStatus(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soldOutNow, setSoldOutNow] = useState(false);
  const [ship, setShip] = useState<(typeof SHIPPING)[number]["id"]>("standard");
  const open = !product.listed ? false : status ? status.enabled && status.open : null;
  const [editionGone, setEditionGone] = useState(false);
  const editionSoldOut = editionGone || status?.editionSoldOut === true;
  const remaining = typeof status?.editionLeft === "number" ? status.editionLeft : EDITION_FOR_SALE;
  const soldOut = editionSoldOut || soldOutNow || (status?.enabled === true && status.copiesLeft === 0);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ship }),
      });
      const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (r.ok && d.url) {
        window.location.assign(d.url);
        return;
      }
      if (r.status === 409 && d.error === "edition_sold_out") {
        setEditionGone(true);
        setBusy(false);
        return;
      }
      if (r.status === 409 && d.error === "sold_out") {
        setSoldOutNow(true);
        setBusy(false);
        return;
      }
      setError("Temporarily unavailable. Please try again later.");
    } catch {
      setError("Temporarily unavailable. Please try again later.");
    }
    setBusy(false);
  }

  return (
    <PageShell>
      <article className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <BookPreview />
        <div>
        <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">The book</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">{product.title}</h1>
        <div className="mt-6 space-y-6 text-sm leading-relaxed sm:text-base">
          <p>
            The Xerographer Specimen Ledger is the whole Xerographer Fonts library in one book: all 1,376 typefaces
            across 530 full-color pages, printed on heavy 100# gloss and bound in an 11.75-inch square hardcover with a
            printed wraparound cover.
          </p>
          <div>
            <h2 className="text-xs uppercase tracking-[0.18em] text-fg-muted">Inside</h2>
            <p className="mt-2">
              Organized into 23 families, from Script, Brush and Calligraphy to Grunge, Techno, Graffiti, Stencil,
              Western and Foreign Look. Each family opens with its own full-page collage.
            </p>
            <p className="mt-2">
              Every face is set large and filled edge to edge with real words, so you see how it actually behaves on a
              page. Fonts with many styles get a full spread of their own. It closes with a set of original art pages.
            </p>
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-[0.18em] text-fg-muted">A working index</h2>
            <p className="mt-2">
              Each specimen has a QR code that takes you straight to that font online, so the printed book doubles as a
              working index to the collection.
            </p>
          </div>
          <p>
            A numbered limited edition of only 500 copies: part reference book, part art object, and the most complete
            record this type library will ever have in print.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap items-baseline gap-3">
          <span className="font-display text-4xl">{product.priceLabel}</span>
          <span className="text-fg-muted">{product.priceNote}</span>
        </div>
        <fieldset className="mt-6">
          <legend className="text-sm font-medium">Shipping</legend>
          <div className="mt-2 space-y-2">
            {SHIPPING.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${ship === s.id ? "border-fg" : "border-border"}`}
              >
                <input
                  type="radio"
                  name="ship"
                  value={s.id}
                  checked={ship === s.id}
                  onChange={() => setShip(s.id)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 font-mono tabular-nums">{s.price}</span>
                  <span className="mt-0.5 block text-sm text-fg-muted">{s.time}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-3 text-sm text-fg-muted">Ships to the continental US (including DC) only.</p>
        <div className="mt-6 rounded-lg border border-border p-4 text-sm">
          Printed to order. Cancel for a full refund until 4:00 PM Pacific on the day you order (orders after 4:00 PM
          PT: until 4:00 PM PT the next day). Once it goes to print, no cancellations or refunds — misprints and
          shipping damage are replaced free. <Link to="/terms" className="underline">Terms of Sale</Link>
        </div>
        <p className="mt-6 text-sm uppercase tracking-[0.18em]" data-testid="edition">
          Limited edition of {EDITION_SIZE}
          {` · ${editionSoldOut ? "sold out" : `${remaining} of ${EDITION_SIZE} copies remaining`}`}
        </p>
        <div className="mt-8">
          {open === false ? (
            <p className="text-fg-muted">Temporarily unavailable.</p>
          ) : (
            <>
              {status?.enabled && (
                <p className="mb-3 text-sm" data-testid="copies-left">
                  {editionSoldOut ? "Sold out: all 500 copies have been claimed" : soldOut ? "Sold out for today, back tomorrow" : `${status.copiesLeft} of ${status.dailyCap ?? status.copiesLeft} copies left today`}
                </p>
              )}
              <Button size="lg" onClick={buy} disabled={busy || open === null || soldOut}>
                {editionSoldOut ? "Sold out" : soldOut ? "Sold out for today" : busy ? "Opening checkout…" : `Buy — ${product.priceLabel}`}
              </Button>
            </>
          )}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
        </div>
      </article>
    </PageShell>
  );
}