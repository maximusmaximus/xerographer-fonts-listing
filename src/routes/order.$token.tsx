import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/order/$token")({
  head: () => ({ meta: [{ title: "Your order — Xerographer Fonts" }, { name: "robots", content: "noindex" }] }),
  component: OrderPage,
});

type View = {
  shortId: string;
  status: string;
  state: string;
  shipMethod: string | null;
  shipTo: string[];
  cancelDeadline: string | null;
  cancellable: boolean;
  tracking: { trackingUrl?: string; trackingNumber?: string; carrier?: string } | null;
  canReport: boolean;
  claimWindowEnds: string | null;
  openRequest: { id: string; photoIds: string[] } | null;
};

const UPLOAD_ERRORS: Record<number, string> = {
  403: "The 14-day window has closed. Please reply to your shipping email instead.",
  409: "That's the limit: up to 3 photos per report.",
  413: "That photo is too large (about 3 MB max).",
  415: "Only JPEG, PNG or WebP photos, please.",
  429: "Too many uploads. Please try again in an hour.",
};

/** Shrink to 2048 px long edge, JPEG q0.85 (also converts HEIC and strips EXIF/GPS). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
}

function OrderPage() {
  const { token } = Route.useParams();
  const [view, setView] = useState<View | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");

  const load = useCallback(() => {
    fetch(`/api/store/order/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setView(d as View | null))
      .catch(() => setView(null));
  }, [token]);
  useEffect(load, [load]);

  async function cancel() {
    if (!confirm("Cancel this order for a full refund?")) return;
    setBusy(true);
    const r = await fetch(`/api/store/order/${encodeURIComponent(token)}/cancel`, { method: "POST" });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    setMsg(r.ok ? "Your cancellation is in. You'll get an email when the refund is issued." : (d.error ?? "Something went wrong."));
    setBusy(false);
    load();
  }

  async function report() {
    setBusy(true);
    const r = await fetch(`/api/store/order/${encodeURIComponent(token)}/reprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    setMsg(r.ok ? "Thanks — now add up to 3 photos of the book and the box." : (d.error ?? "Something went wrong."));
    setBusy(false);
    load();
  }

  async function upload(files: FileList | null, requestId: string) {
    if (!files) return;
    setBusy(true);
    for (const [i, f] of Array.from(files).slice(0, 3).entries()) {
      setMsg(`Uploading photo ${i + 1}…`);
      let blob: Blob;
      try {
        blob = await shrink(f);
      } catch {
        setMsg("We couldn't read that image. Try a JPEG or PNG.");
        break;
      }
      const r = await fetch(`/api/store/order/${encodeURIComponent(token)}/reprint/${requestId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      if (!r.ok) {
        setMsg(UPLOAD_ERRORS[r.status] ?? "Upload failed.");
        break;
      }
      setMsg(`Uploaded ${i + 1} photo(s).`);
    }
    setBusy(false);
    load();
  }

  return (
    <PageShell>
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {view === undefined && <p className="text-fg-muted">Loading…</p>}
        {view === null && <p>We couldn't find that order.</p>}
        {view && (
          <div className="space-y-5">
            <h1 className="font-display text-3xl">Order #{view.shortId}</h1>
            <p className="text-lg">{view.status}</p>
            {view.shipMethod && <p className="text-fg-muted">Shipping: {view.shipMethod}</p>}
            <address className="not-italic text-fg-muted">{view.shipTo.map((l) => <div key={l}>{l}</div>)}</address>
            {view.tracking?.trackingUrl && (
              <p>
                Tracking: <a className="underline" href={view.tracking.trackingUrl} rel="noreferrer" target="_blank">{view.tracking.trackingNumber ?? "track package"}</a>
              </p>
            )}
            {view.cancellable && (
              <div className="rounded-lg border border-border p-4">
                <p>You can cancel for a full refund until <strong>{view.cancelDeadline}</strong>.</p>
                <Button className="mt-3" variant="secondary" onClick={cancel} disabled={busy}>Cancel order for a full refund</Button>
              </div>
            )}
            {view.canReport && !view.openRequest && (
              <div className="rounded-lg border border-border p-4">
                <p className="font-medium">Misprint or damage? Report it by {view.claimWindowEnds} for a free replacement.</p>
                <textarea className="mt-3 w-full rounded border border-border bg-transparent p-2" rows={4} value={description}
                  onChange={(e) => setDescription(e.target.value)} placeholder="What's wrong with your copy?" />
                <Button className="mt-2" onClick={report} disabled={busy || description.trim().length < 5}>Report a problem</Button>
              </div>
            )}
            {view.openRequest && (
              <div className="rounded-lg border border-border p-4">
                <p className="font-medium">Photos for your report (up to 3 photos, about 3 MB each)</p>
                <div className="mt-3 flex gap-2">
                  {view.openRequest.photoIds.map((id) => (
                    <img key={id} alt="Your upload" className="h-20 w-20 rounded object-cover"
                      src={`/api/store/order/${encodeURIComponent(token)}/photos/${id}`} />
                  ))}
                </div>
                {view.openRequest.photoIds.length < 3 && (
                  <input className="mt-3" type="file" accept="image/*" multiple disabled={busy}
                    onChange={(e) => upload(e.target.files, view.openRequest!.id)} />
                )}
              </div>
            )}
            {msg && <p className="text-sm">{msg}</p>}
            <p className="text-sm text-fg-muted"><Link to="/terms" className="underline">Terms of Sale</Link> · Questions? Reply to any order email.</p>
          </div>
        )}
      </article>
    </PageShell>
  );
}
