import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Catalog" },
  { to: "/about", label: "About" },
  { to: "/agents", label: "Agents" },
] as const;

export function SiteHeader() {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-lg tracking-tight sm:text-xl">Xerographer</span>
          <span className="hidden text-xs uppercase tracking-[0.22em] text-fg-muted sm:inline">Fonts</span>
        </Link>
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
          <Button
            variant="ghost"
            size="sm"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggle}
            className="size-11 px-0"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10 text-sm text-fg-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Xerographer Fonts · Max Infeld · Donationware + commercial licenses</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="hover:text-fg" href="https://www.dafont.com/max-infeld.d3584">DaFont</a>
          <a className="hover:text-fg" href="https://maxi.grok.me">maxi.grok.me</a>
          <a className="hover:text-fg" href="https://curio.cards">curio.cards</a>
          <a className="hover:text-fg" href="mailto:maxinfeld@gmail.com">Licensing</a>
        </div>
      </div>
    </footer>
  );
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-hidden bg-bg text-fg">
      <SiteHeader />
      <main className={cn("flex-1", className)}>{children}</main>
      <SiteFooter />
    </div>
  );
}
