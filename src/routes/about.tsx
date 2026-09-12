import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout";
import { STATS } from "@/lib/fonts";
import { formatDownloads } from "@/lib/utils";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">The designer</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">Max Infeld</h1>
        <p className="mt-6 text-lg text-fg-muted">
          Artist, designer, and engineer. Public practice across type, software, and the first art show on Ethereum.
          Based between California and San Francisco.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Typefaces" value={STATS.count.toLocaleString()} />
          <Stat label="DaFont downloads" value={formatDownloads(STATS.downloads)} />
          <Stat label="Started" value="2012" />
        </div>
        <div className="mt-10 space-y-5 text-fg">
          <p>
            Xerographer Fonts is a donationware foundry: {STATS.count.toLocaleString()} original faces drawn since 2012 —
            eroded, cartoon, script, horror, stencil, and the rest of the photocopy cabinet. Personal use lives on DaFont.
            Unlimited commercial use is licensed per face, per licensee, for US$45 via x402.
          </p>
          <p>
            Most art communicates in one direction. The work here is meant to be used: set a line, ship a poster, let an
            agent pay for a grant and keep the receipt.
          </p>
        </div>
        <ul className="mt-10 space-y-3 text-fg">
          <Li href="https://maxi.grok.me" label="maxi.grok.me" detail="Biography and current practice" />
          <Li href="https://curio.cards" label="curio.cards" detail="Curio Cards — early Ethereum art" />
          <Li href="https://www.dafont.com/max-infeld.d3584" label="DaFont author page" detail="The canonical download source" />
          <Li href="https://www.flickr.com/photos/maximusmaximus/" label="Flickr" detail="Photostream" />
          <Li href="https://github.com/maximusmaximus" label="GitHub" detail="maximusmaximus" />
        </ul>
      </article>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated px-4 py-4 shadow-[var(--shadow-border)]">
      <p className="font-display text-2xl">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-fg-muted">{label}</p>
    </div>
  );
}

function Li({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <li>
      <a href={href} className="text-fg underline-offset-4 hover:underline">
        {label}
      </a>
      <span className="text-fg-muted"> — {detail}</span>
    </li>
  );
}
