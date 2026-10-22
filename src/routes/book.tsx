import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStoreStatus } from "@/lib/store-status";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [{ title: "Xerographer Specimen Ledger — Xerographer Fonts" }] }),
  component: BookPage,
});

const SHIPPING = [
  { name: "Standard", price: "$6.99", time: "Prints in ~4 business days, then 2–5 days" },
  { name: "Expedited", price: "$30.99", time: "Prints in ~4 business days, then 2 days" },
  { name: "Rush", price: "$35.99", time: "Prints in ~3 business days, then 1 day" },
];

function BookPage() {
  const status = useStoreStatus(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soldOutNow, setSoldOutNow] = useState(false);
  const open = status ? status.enabled && status.open : null;
  const [editionGone, setEditionGone] = useState(false);
  const editionSoldOut = editionGone || status?.editionSoldOut === true;
  const soldOut = editionSoldOut || soldOutNow || (status?.enabled === true && status.copiesLeft === 0);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/store/checkout", { method: "POST" });
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
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">The book</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">Xerographer Specimen Ledger</h1>
        <p className="mt-4 text-fg-muted">530-page hardcover · 11.75 × 11.75 in · full color on 100# gloss · ImageWrap cover</p>
        <p className="mt-6 text-lg">
          Every Xerographer face, set and printed: the full catalog of 1,376 original typefaces drawn since 2012 —
          eroded, cartoon, script, horror, stencil and the rest of the photocopy cabinet — gathered into one
          oversized specimen ledger.
        </p>
        <div className="mt-8 flex flex-wrap items-baseline gap-3">
          <span className="font-display text-4xl">$250</span>
          <span className="text-fg-muted">plus shipping at cost and sales tax</span>
        </div>
        <table className="mt-6 w-full text-sm">
          <tbody>
            {SHIPPING.map((s) => (
              <tr key={s.name} className="border-t border-border">
                <td className="py-2 pr-3 font-medium">{s.name}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">{s.price}</td>
                <td className="py-2 text-fg-muted">{s.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-fg-muted">Ships to the continental US (including DC) only.</p>
        <div className="mt-6 rounded-lg border border-border p-4 text-sm">
          Printed to order. Cancel for a full refund until 4:00 PM Pacific on the day you order (orders after 4:00 PM
          PT: until 4:00 PM PT the next day). Once it goes to print, no cancellations or refunds — misprints and
          shipping damage are replaced free. <Link to="/terms" className="underline">Terms of Sale</Link>
        </div>
        <p className="mt-6 text-sm uppercase tracking-[0.18em]" data-testid="edition">
          Limited edition of 500
          {typeof status?.editionLeft === "number" && ` · ${editionSoldOut ? "sold out" : `${status.editionLeft} of 500 copies remaining`}`}
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
                {editionSoldOut ? "Sold out" : soldOut ? "Sold out for today" : busy ? "Opening checkout…" : "Buy — $250"}
              </Button>
            </>
          )}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
      </article>
    </PageShell>
  );
}
