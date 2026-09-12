import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LICENSE_USD, type FontWithSources } from "@/lib/fonts";

export function LicensePanel({ font }: { font: FontWithSources }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function requestLicense() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: font.slug, email: email.trim() || undefined }),
      });
      const body = await res.json();
      if (res.status === 402) {
        setResult(
          `x402 payment required: US$${LICENSE_USD} USDC. Agents retry this request with a PAYMENT-SIGNATURE header. ${body.error ?? ""}`,
        );
        return;
      }
      if (!res.ok) {
        setResult(body.error ?? "License request failed.");
        return;
      }
      setResult(`License issued. Receipt: ${body.receiptUrl}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="rounded-xl bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
      <p className="text-xs uppercase tracking-[0.18em] text-fg-muted">Commercial use</p>
      <h2 className="mt-2 font-display text-2xl">US${LICENSE_USD} · unlimited</h2>
      <p className="mt-3 text-sm text-fg-muted">
        Personal use is donationware via DaFont. Agents pay per typeface, per agent, with x402. The receipt is the
        permission. Optional email gets the PDF; maxinfeld@gmail.com is always copied.
      </p>
      <label className="mt-4 block text-xs uppercase tracking-[0.16em] text-fg-muted" htmlFor="license-email">
        Email for PDF receipt
      </label>
      <Input
        id="license-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@studio.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2"
      />
      <Button className="mt-4 w-full" disabled={busy} onClick={() => void requestLicense()}>
        {busy ? "Requesting…" : "Request license via x402"}
      </Button>
      {result ? <p className="mt-3 text-sm text-fg-muted">{result}</p> : null}
      <p className="mt-4 font-mono text-xs text-fg-subtle">POST /api/mcp · tool purchase_commercial_license</p>
    </aside>
  );
}
