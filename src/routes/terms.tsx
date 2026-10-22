import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Specimen Ledger — Terms of Sale" }] }),
  component: Terms,
});

function Terms() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl space-y-5 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl">Specimen Ledger — Terms of Sale (print-on-demand)</h1>
        <p><strong>Printed to order.</strong> Every copy of the Xerographer Specimen Ledger is printed and bound individually after you order, by our print partner, and shipped directly to you.</p>
        <p><strong>Cancellation and refunds.</strong> You may cancel your order for a full refund (book, shipping, and tax) until 4:00 PM Pacific Time on the day you order. If you order after 4:00 PM PT, you may cancel until 4:00 PM PT the following day. To cancel, use the link in your confirmation email or reply to it. A cancellation request we receive before the deadline is honored even if processing takes a little longer. After the deadline your order is sent to print, and it can't be cancelled, returned, or refunded.</p>
        <p><strong>Misprints, damage, and loss.</strong> If your copy arrives with a printing or binding defect, or damaged in shipping, or never arrives, tell us within 14 days of delivery (or of the expected delivery date, for a lost package) with photos of the book and packaging. We'll send a free replacement copy. Replacements are the remedy for these problems; we don't issue refunds for them. Normal variation in color and trim between printed copies isn't a defect.</p>
        <p><strong>Shipping.</strong> Continental US (including DC) only. Shipping is charged at our printer's cost: Standard, Expedited, or Rush. Delivery estimates include about 3–4 business days of printing time and aren't guaranteed.</p>
        <p><strong>Sales tax</strong> is calculated at checkout from your shipping address.</p>
        <p><strong>Address errors.</strong> Please check your address. If a package is returned because of an incorrect address you entered, re-shipping a replacement is at your cost.</p>
        <p>Questions: reply to any order email.</p>
      </article>
    </PageShell>
  );
}
