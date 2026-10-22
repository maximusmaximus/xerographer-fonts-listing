import { createFileRoute } from "@tanstack/react-router";
import { storeDeps, json, notFound, secrets } from "@/lib/store/deps.server";
import { authorizeCron, CRON_JOBS, runCron, type CronJob } from "@/lib/store/cron";

const methodNotAllowed = () => new Response(null, { status: 405, headers: { Allow: "POST" } });

export const Route = createFileRoute("/api/store/cron/$job")({
  server: {
    handlers: {
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
      POST: async ({ request, params }) => {
        if (!CRON_JOBS.includes(params.job as CronJob)) return notFound();
        const deps = await storeDeps();
        if (!deps) return notFound();
        const auth = await authorizeCron(deps, request.headers, `/api/store/cron/${params.job}`, secrets.cron(), Date.now());
        if (!auth.ok) return json(auth.status, { error: auth.status === 409 ? "replayed" : "unauthorized" });
        const summary = await runCron(deps, params.job as CronJob);
        return json(200, { job: params.job, ...summary });
      },
    },
  },
});
