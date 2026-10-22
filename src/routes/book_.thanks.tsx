import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/layout";

export const Route = createFileRoute("/book_/thanks")({
  validateSearch: (s: Record<string, unknown>) => ({ o: typeof s.o === "string" ? s.o : undefined }),
  head: () => ({ meta: [{ title: "Thanks — Xerographer Fonts" }, { name: "robots", content: "noindex" }] }),
  component: Thanks,
});

function Thanks() {
  const { o } = Route.useSearch();
  return (
    <PageShell>
      <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl">Thanks — your order is in</h1>
        <p className="mt-4 text-fg-muted">A confirmation email is on its way, with a link to cancel before the deadline if you change your mind.</p>
        {o && (
          <p className="mt-6">
            <Link to="/order/$token" params={{ token: o }} className="underline">
              View your order
            </Link>
          </p>
        )}
      </article>
    </PageShell>
  );
}
