/** Damage-claim photos stored in Postgres (ADDENDUM-2). */
import type { Db, StoreDeps } from "./types.ts";
import { randomToken, sha256Hex } from "./ids.ts";
import { transition, audit } from "./state.ts";
import { sendAlert, type OrderRow } from "./emails.ts";

export const MAX_PHOTO_BYTES = 3_145_728;
export const MAX_CLAIM_BYTES = 9_437_184;
export const MAX_PHOTOS = 3;
export const PHOTO_ALERT_BYTES = 300 * 1024 * 1024;
const DAY = 86_400_000;

export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return "image/png";
  const ascii = (s: number, e: number) => String.fromCharCode(...b.slice(s, e));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** When the 14-day claim window closes (21 days after shipping if delivery is unknown). */
export function claimWindowEnd(order: OrderRow): Date | null {
  if (order.delivered_at) return new Date(new Date(order.delivered_at).getTime() + 14 * DAY);
  if (order.shipped_at) return new Date(new Date(order.shipped_at).getTime() + 21 * DAY);
  return null;
}

export async function inClaimWindow(deps: StoreDeps, order: OrderRow) {
  const end = claimWindowEnd(order);
  return !!end && (await deps.now()).getTime() < end.getTime();
}

/** Customer "Report a problem": SHIPPED -> REPRINT_REQUESTED. */
export async function createReprintRequest(deps: StoreDeps, order: OrderRow, description: string) {
  if (order.state !== "SHIPPED") return { status: 409, body: { error: "A problem can be reported only after your copy has shipped." } };
  if (!(await inClaimWindow(deps, order))) return { status: 403, body: { error: "claim_window_closed" } };
  const text = description.trim().slice(0, 4000);
  if (text.length < 5) return { status: 400, body: { error: "Please describe the problem." } };
  const id = randomToken();
  await deps.db.query("insert into store_reprint_requests (id, order_id, description) values ($1, $2, $3)", [id, order.id, text]);
  await transition(deps.db, order.id, "REPRINT_REQUESTED", "customer", "problem reported");
  await sendAlert(deps, "Reprint requested", `Order ${order.id.slice(0, 8)} reported a problem. Review photos on the admin page.`);
  return { status: 200, body: { requestId: id } };
}

type UploadResult = { status: number; body: Record<string, unknown> };

export async function uploadClaimPhoto(
  deps: StoreDeps,
  token: string,
  requestId: string,
  contentLength: string | null,
  read: () => Promise<ArrayBuffer>,
): Promise<UploadResult> {
  const notFound = { status: 404, body: {} };
  const [order] = await deps.db.query<OrderRow>("select * from store_orders where id = $1", [token]);
  if (!order) return notFound;
  const [req] = await deps.db.query<{ id: string; order_id: string }>("select id, order_id from store_reprint_requests where id = $1", [requestId]);
  if (!req || req.order_id !== order.id) return notFound;

  const now = await deps.now();
  const [{ n }] = await deps.db.query<{ n: number }>(
    "select count(*)::int as n from store_audit where order_id = $1 and note = 'photo_upload_attempt' and at > $2",
    [order.id, new Date(now.getTime() - 3_600_000).toISOString()],
  );
  await deps.db.query("insert into store_audit (order_id, actor, note, at) values ($1, 'customer', 'photo_upload_attempt', $2)", [order.id, now.toISOString()]);
  if (n >= 10) return { status: 429, body: { error: "too many uploads, try again in an hour" } };

  if (!order.shipped_at || !(await inClaimWindow(deps, order))) return { status: 403, body: { error: "claim_window_closed" } };
  const len = Number(contentLength);
  if (!contentLength || !Number.isFinite(len) || len > MAX_PHOTO_BYTES) return { status: 413, body: { error: "photo too large" } };
  const bytes = new Uint8Array(await read());
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return { status: 413, body: { error: "photo too large" } };
  const mime = sniffImage(bytes);
  if (!mime) return { status: 415, body: { error: "only JPEG, PNG or WebP photos" } };
  const hash = sha256Hex(bytes);

  const [dup] = await deps.db.query<{ id: string }>("select id from store_claim_photos where request_id = $1 and sha256 = $2", [requestId, hash]);
  if (dup) return { status: 200, body: { photoId: dup.id, ...(await counts(deps.db, requestId)) } };

  const id = randomToken();
  // Single guarded statement: locks the claim row, then inserts only if the per-claim limits still hold.
  const inserted = await deps.db.query<{ id: string }>(
    `with r as (select id from store_reprint_requests where id = $2 for update),
          s as (select count(*)::int as c, coalesce(sum(byte_size), 0)::int as total
                from store_claim_photos where request_id = $2 and purged_at is null)
     insert into store_claim_photos (id, request_id, order_id, mime, byte_size, sha256, data)
     select $1, $2, $3, $4, $5, $6, $7 from r, s
     where s.c < ${MAX_PHOTOS} and s.total + $5 <= ${MAX_CLAIM_BYTES}
     on conflict (request_id, sha256) do nothing
     returning id`,
    [id, requestId, order.id, mime, bytes.length, hash, Buffer.from(bytes)],
  );
  if (!inserted.length) {
    const [again] = await deps.db.query<{ id: string }>("select id from store_claim_photos where request_id = $1 and sha256 = $2", [requestId, hash]);
    if (again) return { status: 200, body: { photoId: again.id, ...(await counts(deps.db, requestId)) } };
    return { status: 409, body: { error: "up to 3 photos, 9 MB total" } };
  }
  await audit(deps.db, order.id, "customer", `photo_uploaded ${mime} ${bytes.length}B`);
  return { status: 200, body: { photoId: id, ...(await counts(deps.db, requestId)) } };
}

async function counts(db: Db, requestId: string) {
  const [{ c }] = await db.query<{ c: number }>("select count(*)::int as c from store_claim_photos where request_id = $1 and purged_at is null", [requestId]);
  return { count: c, remaining: Math.max(0, MAX_PHOTOS - c) };
}

export async function readPhoto(db: Db, photoId: string, orderToken?: string) {
  const [p] = await db.query<{ id: string; order_id: string; request_id: string; mime: string; data: Uint8Array | null; purged_at: string | null }>(
    "select id, order_id, request_id, mime, data, purged_at from store_claim_photos where id = $1",
    [photoId],
  );
  if (!p || (orderToken !== undefined && p.order_id !== orderToken)) return { status: 404 as const };
  if (p.purged_at || !p.data) return { status: 410 as const };
  const ext = p.mime.split("/")[1] === "jpeg" ? "jpg" : p.mime.split("/")[1];
  return {
    status: 200 as const,
    bytes: new Uint8Array(p.data),
    headers: {
      "Content-Type": p.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="claim-${p.request_id}-${p.id.slice(0, 6)}.${ext}"`,
    },
  };
}

export async function purgePhotos(deps: StoreDeps): Promise<number> {
  const now = (await deps.now()).getTime();
  const rows = await deps.db.query<{ id: string }>(
    `update store_claim_photos p set data = null, purged_at = $1
     from store_reprint_requests r
     where p.request_id = r.id and p.purged_at is null and (
       (r.decided_at is not null and r.decided_at < $2) or (r.decided_at is null and p.created_at < $3))
     returning p.id`,
    [new Date(now).toISOString(), new Date(now - 90 * DAY).toISOString(), new Date(now - 120 * DAY).toISOString()],
  );
  if (rows.length) await audit(deps.db, null, "cron", `purged ${rows.length} claim photo(s)`);
  return rows.length;
}

export async function totalPhotoBytes(db: Db): Promise<number> {
  const [{ b }] = await db.query<{ b: number }>("select coalesce(sum(byte_size), 0)::int as b from store_claim_photos where purged_at is null");
  return b;
}
