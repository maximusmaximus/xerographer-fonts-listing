import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout";
import { CATALOG_LICENSE_USD, GITHUB_FONTS_REPO, LICENSE_USD, usdLabel } from "@/lib/constants";
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
          <Stat label="Downloads" value={formatDownloads(STATS.downloads)} />
          <Stat label="Started" value="2012" />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-fg-muted">DaFont</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">{formatDownloads(STATS.dafontDownloads)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-fg-muted">FontSpace</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">{formatDownloads(STATS.fontspaceDownloads)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-fg-muted">WebFontFree</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">{formatDownloads(STATS.webfontfreeDownloads)}</dd>
          </div>
        </dl>
        <div className="mt-10 space-y-5 text-fg">
          <p>
            Xerographer Fonts is a donationware foundry: {STATS.count.toLocaleString()} original faces drawn since 2012 —
            eroded, cartoon, script, horror, stencil, and the rest of the photocopy cabinet. Personal use lives on DaFont.
            Unlimited commercial use is licensed per face, per licensee, for {usdLabel(LICENSE_USD)} via x402 — or{" "}
            {usdLabel(CATALOG_LICENSE_USD)} for the entire catalog for a single agent. Font files may not be resold
            or redistributed. Typefaces may not be edited or used to create derivative fonts without written
            permission.
          </p>
          <p>
            Most art communicates in one direction. The work here is meant to be used: set a line, ship a poster, let an
            agent pay for a grant and keep the receipt.
          </p>
        </div>
        <ul className="mt-10 space-y-3 text-fg">
          <Li href="https://maxi.grok.me" label="maxi.grok.me" detail="Biography and current practice" />
          <Li href="https://curio.cards" label="curio.cards" detail="Curio Cards — early Ethereum art" />
          <Li href="https://www.dafont.com/max-infeld.d3584" label="DaFont author page" detail="Canonical download source" />
          <Li href="https://www.fontspace.com/xerographer-fonts" label="FontSpace" detail={`${STATS.hostCounts.fontspace} faces`} />
          <Li href="https://blogfonts.com/user/424.htm" label="BlogFonts" detail={`${STATS.hostCounts.blogfonts} faces`} />
          <Li href="https://www.webfontfree.com/en/designers/859" label="WebFontFree" detail={`${STATS.hostCounts.webfontfree} faces`} />
          <Li href="https://www.heyfonts.com/designer/max-infeld-xerographer-fonts/" label="Hey Fonts" detail={`${STATS.hostCounts.heyfonts} faces`} />
          <Li href="https://www.ffonts.net/tag/infeld" label="FFonts" detail="Linked on every face" />
          <Li href="https://fonts2u.com/search.html?q=xerographer" label="Fonts2u" detail="Linked on every face" />
          <Li href="https://www.fontget.com/?s=xerographer" label="FontGet" detail="Linked on every face" />
          <Li href="https://www.whatfontis.com/" label="WhatFontIs" detail="Linked on every face" />
          <Li href="https://www.1001freefonts.com/designer-xerographer-fonts-fontlisting.php" label="1001 Free Fonts" detail="Designer listing" />
          <Li href="https://www.flickr.com/photos/maximusmaximus/" label="Flickr" detail="Photostream" />
          <Li href={GITHUB_FONTS_REPO} label="GitHub" detail="Every face and variation, copyright Max Infeld" />
          <Li href="https://github.com/maximusmaximus" label="GitHub profile" detail="maximusmaximus" />
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
