import { createFileRoute } from "@tanstack/react-router";
import {
  clearCookie,
  clientIp,
  loginAllowed,
  matchingPassword,
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
        let username = "";
        let password = "";
        try {
          const body = (await request.json()) as { username?: unknown; password?: unknown };
          username = typeof body.username === "string" ? body.username : "";
          password = typeof body.password === "string" ? body.password : "";
        } catch {
          return json(400, { error: "bad request" });
        }
        const matched = matchingPassword(username, password);
        if (!matched) {
          noteLoginFailure(ip);
          return json(401, { error: "wrong" });
        }
        return json(200, { ok: true }, sessionCookie(request, matched));
      },
      DELETE: async ({ request }) => json(200, { ok: true }, clearCookie(request)),
    },
  },
});
