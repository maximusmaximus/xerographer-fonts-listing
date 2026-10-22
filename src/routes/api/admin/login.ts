import { createFileRoute } from "@tanstack/react-router";
import {
  adminCredentials,
  clearCookie,
  clientIp,
  credentialsMatch,
  loginAllowed,
  noteLoginFailure,
  sameOrigin,
  sessionCookie,
} from "@/lib/admin-auth.server";

function json(status: number, body: unknown, cookie?: string): Response {
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export const Route = createFileRoute("/api/admin/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return json(403, { error: "bad origin" });
        const ip = clientIp(request);
        if (!loginAllowed(ip)) return json(429, { error: "too many tries" });
        const creds = adminCredentials();
        let username = "";
        let password = "";
        try {
          const body = (await request.json()) as { username?: unknown; password?: unknown };
          username = typeof body.username === "string" ? body.username : "";
          password = typeof body.password === "string" ? body.password : "";
        } catch {
          return json(400, { error: "bad request" });
        }
        if (!creds || !credentialsMatch(username, password, creds.username, creds.password)) {
          noteLoginFailure(ip);
          return json(401, { error: "wrong" });
        }
        return json(200, { ok: true }, sessionCookie(request, creds.password));
      },
      DELETE: async ({ request }) => json(200, { ok: true }, clearCookie(request)),
    },
  },
});
