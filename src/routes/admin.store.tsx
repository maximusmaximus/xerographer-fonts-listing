import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/store")({
  head: () => ({ meta: [{ title: "Store admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminStore,
});

type Summary = {
  env: string;
  ordersEnabled: boolean;
  maxOrdersPerDay: number;
  maxExposureUsdPerDay: number;
  clockOverride: string | null;
  cap: { count: number; exposure: number };
  copies: { cap: number; taken: number; left: number };
  photoBytes: number;
  orders: Array<Record<string, string | number | null>>;
  requests: Array<{ id: string; order_id: string; description: string; decision: string | null; photos: Array<{ id: string; mime: string; size: number; at: string; purged: boolean }> }>;
};

const KEY = "store-admin-token";

function AdminStore() {
  // Token lives only in this tab's sessionStorage; never in the bundle.
  const [token, setToken] = useState("");
  const [data, setData] = useState<Summary | null>(null);
  const [msg, setMsg] = useState("");
  const [override, setOverride] = useState(false);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => setToken(sessionStorage.getItem(KEY) ?? ""), []);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch("/api/store/admin", { headers: { "x-admin-token": token } });
    if (r.status === 401) {
      setData(null);
      setMsg("Wrong admin token.");
      return;
    }
    if (!r.ok) {
      setMsg(`Store not available (${r.status}).`);
      return;
    }
    setData((await r.json()) as Summary);
    const h = await fetch("/api/store/admin/health", { headers: { "x-admin-token": token } });
    setHealth(h.ok ? ((await h.json()) as Record<string, unknown>) : null);
  }, [token]);
  useEffect(() => void load(), [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    const r = await fetch("/api/store/admin", {
      method: "POST",
      headers: { "x-admin-token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setMsg(`${action}: ${r.status} ${JSON.stringify(await r.json().catch(() => ({})))}`);
    void load();
  }

  async function download(photoId: string) {
    const r = await fetch(`/api/store/admin/photos/${photoId}`, { headers: { "x-admin-token": token } });
    if (!r.ok) return setMsg(`photo: ${r.status}`);
    const url = URL.createObjectURL(await r.blob());
    window.open(url, "_blank");
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-2xl">Store admin</h1>
        <form className="mt-4 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const v = (new FormData(e.currentTarget).get("t") as string) ?? "";
          sessionStorage.setItem(KEY, v);
          setToken(v);
        }}>
          <input name="t" type="password" className="flex-1 rounded border px-2" placeholder="Admin token" />
          <Button type="submit">Open</Button>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-sm">
      <h1 className="text-2xl">Store admin ({data.env})</h1>
      <section className="flex flex-wrap items-center gap-3">
        <span>Orders enabled: <strong>{String(data.ordersEnabled)}</strong></span>
        <Button size="sm" onClick={() => act("set-enabled", { value: String(!data.ordersEnabled) })}>
          {data.ordersEnabled ? "Turn orders OFF" : "Turn orders ON"}
        </Button>
        <span>Today: {data.cap.count} sent, ~${data.cap.exposure}</span>
        <span>Caps (env DAILY_ORDER_CAP / DAILY_DOLLAR_CAP): {data.maxOrdersPerDay} orders / ${data.maxExposureUsdPerDay} · copies left today: {data.copies.left}/{data.copies.cap}</span>
        <Button size="sm" variant="secondary" onClick={() => act("test-emails")}>Send test emails to ALERT_EMAIL_TO</Button>
        <Button size="sm" variant="secondary" onClick={() => act("rpi-ping")}>RPI ping</Button>
        <span>Photos stored: {(data.photoBytes / 1e6).toFixed(1)} MB</span>
      </section>
      {data.env === "sbx" && (
        <section className="flex flex-wrap items-center gap-3 rounded border border-dashed p-3">
          <strong>Sandbox self-tests</strong>
          <span>Clock override: {data.clockOverride ?? "none"}</span>
          <Button size="sm" variant="secondary" onClick={() => {
            const v = prompt("Pretend it is (ISO time, e.g. 2026-10-13T16:30:00-07:00)");
            if (v) void act("clock-override", { value: v });
          }}>Set clock</Button>
          <Button size="sm" variant="secondary" onClick={() => act("clock-override", { value: "" })}>Clear clock</Button>
          <Button size="sm" variant="secondary" onClick={() => act("drop-next-rpi-webhook")}>Drop next RPI webhook</Button>
        </section>
      )}
      <label className="flex items-center gap-2"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Max override (allow cancel after LOCKED)</label>
      <table className="w-full">
        <thead><tr className="text-left"><th>Order</th><th>State</th><th>Created</th><th>Ship</th><th>RPI</th><th>Error</th><th /></tr></thead>
        <tbody>
          {data.orders.map((o) => (
            <tr key={String(o.id)} className="border-t align-top">
              <td className="font-mono">{String(o.id).slice(0, 8)}</td>
              <td>{o.state}</td>
              <td>{String(o.created_at).slice(0, 16)}</td>
              <td>{o.ship_method}</td>
              <td>{o.rpi_status}</td>
              <td className="max-w-xs truncate">{o.last_error}</td>
              <td className="space-x-1 whitespace-nowrap">
                {o.state === "HELD" && <Button size="sm" onClick={() => act("release", { orderId: o.id })}>Release</Button>}
                <Button size="sm" variant="secondary" onClick={() => confirm("Cancel and refund in full?") && act("cancel-refund", { orderId: o.id, maxOverride: override })}>Cancel+Refund</Button>
                {o.state === "REPRINT_REQUESTED" && <>
                  <Button size="sm" onClick={() => act("approve-reprint", { orderId: o.id })}>Approve reprint</Button>
                  <Button size="sm" variant="secondary" onClick={() => act("decline-reprint", { orderId: o.id })}>Decline reprint</Button>
                </>}
                {o.state === "REPRINT_APPROVED" && <>
                  <Button size="sm" variant="secondary" onClick={() => confirm("Place a replacement order at your cost?") && act("replacement-order", { orderId: o.id })}>Place replacement order</Button>
                  <Button size="sm" variant="secondary" onClick={() => act("replacement-shipped", { orderId: o.id, value: prompt("Tracking URL") ?? "" })}>Replacement shipped</Button>
                </>}
                {o.state === "NEEDS_ATTENTION" && <Button size="sm" variant="secondary" onClick={() => {
                  const v = prompt("Resolve to state (e.g. LOCKED, SHIPPED, CANCELLED_REFUNDED)");
                  if (v) void act("resolve", { orderId: o.id, value: v });
                }}>Resolve</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="text-xl">Health</h2>
      {health ? <HealthList value={health} /> : <p className="text-sm">Health unavailable.</p>}
      <h2 className="text-xl">Reprint requests</h2>
      {data.requests.map((r) => (
        <div key={r.id} className="rounded border p-3">
          <p>Order {r.order_id.slice(0, 8)} · {r.decision ?? "open"}</p>
          <p className="whitespace-pre-wrap text-fg-muted">{r.description}</p>
          <ul className="mt-2">
            {r.photos.map((p) => (
              <li key={p.id}>
                {p.mime} · {(p.size / 1e6).toFixed(2)} MB · {String(p.at).slice(0, 16)}{" "}
                {p.purged ? "(purged)" : <button className="underline" onClick={() => download(p.id)}>open</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {msg && <pre className="whitespace-pre-wrap">{msg}</pre>}
    </main>
  );
}

function HealthList({ value, prefix = "" }: { value: Record<string, unknown>; prefix?: string }) {
  return (
    <ul className="text-sm">
      {Object.entries(value).map(([k, v]) =>
        v && typeof v === "object" ? (
          <li key={k}><b>{prefix + k}</b><HealthList value={v as Record<string, unknown>} prefix="  " /></li>
        ) : (
          <li key={k}>{v === true ? "✅" : v === false ? "❌" : "•"} {prefix + k}{typeof v === "boolean" ? "" : `: ${String(v)}`}</li>
        ),
      )}
    </ul>
  );
}
