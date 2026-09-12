import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout";
import { LICENSE_USD } from "@/lib/constants";

export const Route = createFileRoute("/agents")({ component: Agents });

function Agents() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">MCP + x402</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">A foundry for agents</h1>
        <p className="mt-5 text-lg text-fg-muted">
          Full Model Context Protocol service. Browse the catalog, preview text, and buy an Unlimited Commercial Use
          license for US${LICENSE_USD} USDC per font per agent. Payment is x402. The PAYMENT-RESPONSE is the grant.
        </p>

        <h2 className="mt-12 text-2xl">Connect</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-bg-elevated p-4 font-mono text-xs text-fg shadow-[var(--shadow-border)]">
{`{
  "mcpServers": {
    "xerographer-fonts": {
      "url": "/api/mcp"
    }
  }
}`}
        </pre>
        <p className="mt-3 text-sm text-fg-muted">
          Discovery: <code className="font-mono">/.well-known/mcp.json</code> and <code className="font-mono">/llms.txt</code>.
        </p>

        <h2 className="mt-12 text-2xl">Tools</h2>
        <ul className="mt-4 space-y-3 text-sm text-fg-muted">
          <li><span className="font-mono text-fg">list_fonts</span> — search, category, sort, pagination</li>
          <li><span className="font-mono text-fg">get_font</span> — metadata and source links (DaFont plus nine mirrors)</li>
          <li><span className="font-mono text-fg">list_categories</span> — DaFont themes</li>
          <li><span className="font-mono text-fg">preview_text</span> — live TTF URL + specimen</li>
          <li><span className="font-mono text-fg">purchase_commercial_license</span> — x402, US${LICENSE_USD}, optional email</li>
          <li><span className="font-mono text-fg">get_license</span> — receipt + PDF</li>
        </ul>

        <h2 className="mt-12 text-2xl">Pay</h2>
        <p className="mt-4 text-fg-muted">
          Call <span className="font-mono text-fg">purchase_commercial_license</span> with a font slug and optional email.
          The HTTP response is <span className="font-mono text-fg">402 Payment Required</span> with a
          <span className="font-mono text-fg"> PAYMENT-REQUIRED</span> header (USDC on Base, exact scheme, {LICENSE_USD} dollars).
          Retry with <span className="font-mono text-fg">PAYMENT-SIGNATURE</span>. On settle you receive:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-fg-muted">
          <li>x402 PAYMENT-RESPONSE — machine-readable unlimited commercial use grant</li>
          <li>JSON receipt with DaFont and download source links</li>
          <li>PDF certificate at /api/licenses/:id/pdf</li>
          <li>Email of that PDF if you passed an address; maxinfeld@gmail.com always gets a copy</li>
        </ul>
        <p className="mt-4 text-sm text-fg-muted">
          One payment licenses one typeface for one payer (wallet / agent). Repeat purchases return the existing receipt
          without charging again.
        </p>
      </article>
    </PageShell>
  );
}
