import { createFileRoute } from "@tanstack/react-router";
import { CatalogExplorer } from "@/components/catalog";
import { PageShell } from "@/components/layout";
import { parseFontSearch } from "@/lib/font-search";

export const Route = createFileRoute("/")({
  validateSearch: parseFontSearch,
  head: ({ match }) => {
    const text = match.search.text?.trim();
    return {
      meta: [{ title: text ? `${text} — Xerographer Fonts` : "Xerographer Fonts" }],
    };
  },
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  return (
    <PageShell>
      <CatalogExplorer incoming={search} />
    </PageShell>
  );
}
