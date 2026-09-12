import { createFileRoute } from "@tanstack/react-router";
import { CatalogExplorer } from "@/components/catalog";
import { PageShell } from "@/components/layout";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <PageShell>
      <CatalogExplorer />
    </PageShell>
  );
}
