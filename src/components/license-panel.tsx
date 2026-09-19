import { useState } from "react";
import { HintSpot } from "@/components/guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATALOG_LICENSE_USD,
  LICENSE_TERMS,
  LICENSE_USD,
  usdLabel,
} from "@/lib/constants";
import type { FontWithSources } from "@/lib/fonts";

export function LicensePanel({ font }: { font?: FontWithSources }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"font" | "catalog" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function requestLicense(kind: "font" | "catalog") {
    setBusy(kind);
    setResult(null);
    try {
      const body =
        kind === "catalog"
          ? { catalog: true, email: email.trim() || undefined }
          : { slug: font?.slug, email: email.trim() || undefined };
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      const price = kind === "catalog" ? CATALOG_LICENSE_USD : LICENSE_USD;
      if (res.status === 402) {
        setResult(
          `x402 payment required: ${usdLabel(price)} USDC. Agents retry this request with a PAYMENT-SIGNATURE header. ${payload.error ?? ""}`,
        );
        return;
      }
      if (!res.ok) {
        setResult(payload.error ?? "License request failed.");
        return;
      }
      setResult(`License issued. Receipt: ${payload.receiptUrl}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <HintSpot id="license">
    <aside className="rounded-xl bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
      <p className="text-xs uppercase tracking-[0.18em] text-fg-muted">Commercial use</p>
      {font ? (
        <>
          <h2 className="mt-2 font-display text-2xl">{usdLabel(LICENSE_USD)} · this face</h2>
          <p className="mt-3 text-sm text-fg-muted">
            Unlimited commercial use for one agent. Personal use is donationware via DaFont. The receipt is the
            permission.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-2 font-display text-2xl">{usdLabel(LICENSE_USD)} · per face</h2>
          <p className="mt-3 text-sm text-fg-muted">
            One typeface, one agent, settled with x402. Or license the whole foundry below.
          </p>
        </>
      )}
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
      {font ? (
        <Button className="mt-4 w-full" disabled={busy !== null} onClick={() => void requestLicense("font")}>
          {busy === "font" ? "Requesting…" : `License this face · ${usdLabel(LICENSE_USD)}`}
        </Button>
      ) : null}
      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-display text-xl">{usdLabel(CATALOG_LICENSE_USD)} · entire catalog</h3>
        <p className="mt-2 text-sm text-fg-muted">
          One agent, every Xerographer typeface. Same terms. Same x402 receipt.
        </p>
        <Button
          className="mt-4 w-full"
          variant={font ? "secondary" : "primary"}
          disabled={busy !== null}
          onClick={() => void requestLicense("catalog")}
        >
          {busy === "catalog" ? "Requesting…" : `License all fonts · ${usdLabel(CATALOG_LICENSE_USD)}`}
        </Button>
      </div>
      {result ? <p className="mt-3 text-sm text-fg-muted">{result}</p> : null}
      <p className="mt-4 text-xs leading-relaxed text-fg-subtle">{LICENSE_TERMS}</p>
      <p className="mt-4 font-mono text-xs text-fg-subtle">
        POST /api/mcp · {font ? "purchase_commercial_license" : "purchase_catalog_license"}
      </p>
    </aside>
    </HintSpot>
  );
}
