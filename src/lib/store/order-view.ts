import type { StoreDeps } from "./types.ts";
import type { OrderRow } from "./emails.ts";
import { isCustomerCancellable } from "./cancel.ts";
import { claimWindowEnd, inClaimWindow } from "./photos.ts";
import { formatPt } from "./time.ts";

const PLAIN: Record<string, string> = {
  CHECKOUT_OPEN: "Waiting for payment",
  PAID: "Paid — getting ready to print",
  DEFERRED: "Paid — goes to the printer tonight",
  HELD: "Paid — being reviewed before printing",
  RPI_CREATING: "Sending to the printer",
  RPI_CREATED: "At the printer, checking files",
  CANCEL_WINDOW: "At the printer, waiting for the print run",
  CANCEL_REQUESTED: "Cancellation in progress",
  CANCELLED_REFUNDED: "Cancelled and refunded",
  PREFLIGHT_REJECTED: "Fixing a file problem at the printer",
  RPI_REJECTED: "Queued at the printer",
  LOCKED: "Printing",
  SHIPPED: "Shipped",
  REPRINT_REQUESTED: "Problem reported — we're reviewing it",
  REPRINT_APPROVED: "Replacement approved",
  REPRINT_SHIPPED: "Replacement shipped",
  REPRINT_DECLINED: "Problem report reviewed",
  NEEDS_ATTENTION: "We're looking into your order",
  DISPUTED: "Payment disputed",
  EXPIRED: "Checkout expired",
};

export async function publicOrderView(deps: StoreDeps, token: string) {
  const [o] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [token]);
  if (!o || o.state === "CHECKOUT_OPEN" || o.state === "EXPIRED") return null;
  let address: Record<string, string> = {};
  let tracking: Record<string, string> = {};
  try {
    address = JSON.parse(o.ship_address_json ?? "{}");
    tracking = JSON.parse(o.tracking_json ?? "{}");
  } catch {
    /* ignore */
  }
  const requests = await deps.db.query<{ id: string; decision: string | null }>(
    "select id, decision from store_reprint_requests where order_id = $1 order by created_at desc",
    [o.id],
  );
  const openRequest = requests.find((r) => !r.decision) ?? null;
  const photos = openRequest
    ? await deps.db.query<{ id: string }>("select id from store_claim_photos where request_id = $1 and purged_at is null order by created_at", [openRequest.id])
    : [];
  const windowOpen = await inClaimWindow(deps, o);
  const end = claimWindowEnd(o);
  return {
    shortId: o.id.slice(0, 8),
    status: PLAIN[o.state] ?? o.state,
    state: o.state,
    shipMethod: o.ship_method,
    shipTo: [o.ship_name, address.line1, address.line2, `${address.city ?? ""}, ${address.state ?? ""} ${address.postal_code ?? ""}`].filter(Boolean),
    totalCents: o.amount_total_cents,
    cancelDeadline: o.cancel_deadline_utc ? formatPt(new Date(o.cancel_deadline_utc)) : null,
    cancellable: await isCustomerCancellable(deps, o),
    tracking: tracking.trackingUrl ? tracking : null,
    canReport: o.state === "SHIPPED" && windowOpen,
    claimWindowEnds: end ? formatPt(end) : null,
    openRequest: openRequest && windowOpen ? { id: openRequest.id, photoIds: photos.map((p) => p.id) } : null,
  };
}
