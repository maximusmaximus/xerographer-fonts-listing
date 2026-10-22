import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PageShell } from "@/components/layout";
import type { BookProduct } from "@/lib/product";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Xerographer Fonts" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [product, setProduct] = useState<BookProduct | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/product", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as { product: BookProduct };
      setProduct(data.product);
    });
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setPending(false);
    if (res.status === 429) {
      setError("Too many tries. Wait a few minutes.");
      return;
    }
    if (!res.ok) {
      setError("That username or password is wrong.");
      return;
    }
    setPassword("");
    const next = await fetch("/api/admin/product", { cache: "no-store" });
    if (!next.ok) {
      setError("Signed in, but the editor didn't open. Try again.");
      return;
    }
    const data = (await next.json()) as { product: BookProduct };
    setProduct(data.product);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    setPending(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/admin/product", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(product),
    });
    setPending(false);
    if (res.status === 401) {
      setProduct(null);
      setError("Your session ended. Sign in again.");
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't save.");
      return;
    }
    setNotice("Saved. The book page is updated.");
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setProduct(null);
    setNotice("");
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.22em] text-fg-muted">Admin</p>
        <h1 className="mt-3 font-display text-4xl">Product editor</h1>
        {product ? (
          <form className="mt-8 space-y-4" onSubmit={save}>
            <label className="block text-sm">
              Title
              <Input className="mt-1" value={product.title} onChange={(e) => setProduct({ ...product, title: e.target.value })} />
            </label>
            <label className="block text-sm">
              Specs
              <Input className="mt-1" value={product.specs} onChange={(e) => setProduct({ ...product, specs: e.target.value })} />
            </label>
            <label className="block text-sm">
              Description
              <Textarea className="mt-1" value={product.description} onChange={(e) => setProduct({ ...product, description: e.target.value })} />
            </label>
            <label className="block text-sm">
              Price
              <Input className="mt-1" value={product.priceLabel} onChange={(e) => setProduct({ ...product, priceLabel: e.target.value })} />
            </label>
            <label className="block text-sm">
              Price note
              <Input className="mt-1" value={product.priceNote} onChange={(e) => setProduct({ ...product, priceNote: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={product.listed}
                onChange={(e) => setProduct({ ...product, listed: e.target.checked })}
              />
              Listed for sale on the book page
            </label>
            <p className="text-sm text-fg-muted">
              The price shown here is the label on the page. Stripe still charges the live price on the host.
            </p>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {notice ? <p className="text-sm">{notice}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void logout()}>
                Sign out
              </Button>
              <Link to="/book" className="self-center text-sm text-fg-muted underline">
                View the book page
              </Link>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={login}>
            <label className="block text-sm">
              Username
              <Input
                className="mt-1"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Password
              <Input
                className="mt-1"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button type="submit" disabled={pending || !username || !password}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
