import { BookPromo } from "@/components/book-promo";
import { Link } from "@tanstack/react-router";
import { Github, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { GuideToggle, HintSpot } from "@/components/guide";
import { Button } from "@/components/ui/button";
import { GITHUB_FONTS_REPO } from "@/lib/constants";
import { pickHeaderFont } from "@/lib/fonts";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Catalog" },
  { to: "/about", label: "About" },
  { to: "/agents", label: "Agents" },
] as const;

let headerPick: ReturnType<typeof pickHeaderFont> | null = null;

function loadHeaderFace(slug: string, family: string): Promise<boolean> {
  const face = new FontFace(family, `url(/api/font-file/${slug})`);
  return face
    .load()
    .then((ready) => {
      document.fonts.add(ready);
      return true;
    })
    .catch(() => false);
}

function HeaderWordmark() {
  const [family, setFamily] = useState<string | null>(null);
  const [fontName, setFontName] = useState<string | null>(null);

  useEffect(() => {
    if (!headerPick) headerPick = pickHeaderFont();
    const font = headerPick;
    const fam = `xf-${font.slug}`;
    setFontName(font.name);
    void loadHeaderFace(font.slug, fam).then((ok) => {
      if (ok) setFamily(fam);
    });
  }, []);

  return (
    <Link to="/" className="flex min-w-0 items-baseline gap-2">
      <span
        className="max-w-[46vw] truncate text-lg tracking-tight sm:max-w-none sm:text-xl"
        style={{ fontFamily: family ? `${family}, var(--font-display)` : "var(--font-display)" }}
        title={fontName ? `Set in ${fontName}` : "Xerographer Fonts"}
      >
        Xerographer
      </span>
      <span className="hidden text-xs uppercase tracking-[0.22em] text-fg-muted sm:inline">Fonts</span>
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <HintSpot id="theme" badge="left" className="shrink-0">
      <Button
        variant="ghost"
        size="sm"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggle}
        className="size-11 px-0"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </HintSpot>
  );
}

function BookTab() {
  return (
    <Button asChild variant="primary" size="sm" className="ml-0.5 shrink-0 px-2.5 text-xs sm:ml-1 sm:px-3 sm:text-sm">
      <Link to="/book" data-book-tab>
        Specimen Book
      </Link>
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <HeaderWordmark />
        <nav className="flex min-w-0 shrink items-center gap-0.5 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex h-11 items-center px-1.5 text-xs text-fg-muted transition-colors hover:text-fg sm:px-3 sm:text-sm"
              activeProps={{ className: "text-fg" }}
            >
              {link.label}
            </Link>
          ))}
          <BookTab />
          <a
            href={GITHUB_FONTS_REPO}
            className="inline-flex h-11 items-center gap-1.5 px-1.5 text-xs text-fg-muted transition-colors hover:text-fg sm:px-3 sm:text-sm"
            aria-label="GitHub font files"
          >
            <Github className="size-4" aria-hidden />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <GuideToggle />
          <ThemeToggle />
        </nav>
      </div>
      <BookPromo />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10 text-sm text-fg-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Xerographer Fonts · Max Infeld · Donationware + commercial licenses</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="hover:text-fg" href="https://www.dafont.com/max-infeld.d3584">
            DaFont
          </a>
          <a className="hover:text-fg" href="https://www.fontspace.com/xerographer-fonts">
            FontSpace
          </a>
          <a className="hover:text-fg" href="https://blogfonts.com/user/424.htm">
            BlogFonts
          </a>
          <a className="hover:text-fg" href="https://maxi.grok.me">
            maxi.grok.me
          </a>
          <a className="hover:text-fg" href="https://curio.cards">
            curio.cards
          </a>
          <a className="hover:text-fg" href={GITHUB_FONTS_REPO}>
            GitHub
          </a>
          <a className="hover:text-fg" href="mailto:maxinfeld@gmail.com">
            Licensing
          </a>
          <Link to="/admin" className="hover:text-fg">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function PageShell({
  children,
  className,
  footer = true,
  chrome = "site",
}: {
  children: ReactNode;
  className?: string;
  footer?: boolean;
  chrome?: "site" | "studio";
}) {
  if (chrome === "studio") {
    return (
      <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-bg text-fg">
        <main className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>{children}</main>
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-hidden bg-bg text-fg">
      <SiteHeader />
      <main className={cn("min-h-0 flex-1", className)}>{children}</main>
      {footer ? <SiteFooter /> : null}
    </div>
  );
}
