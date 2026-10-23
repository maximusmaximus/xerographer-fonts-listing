/**
 * Server-only environment access.
 *
 * Production secrets (DATABASE_URL, X402_PAY_TO, X402_NETWORK,
 * X402_FACILITATOR_URL, RESEND_API_KEY, RESEND_FROM) are injected by the
 * host. Never hard-code a value, never prefix a secret with VITE_, and never
 * unset or overwrite an existing production variable during an update.
 * Names only: .env.example.
 *
 * If the host did not set a name, the dev file `.secrets/dev.env` fills it.
 * That file is gitignored. A non-empty host value always wins.
 */
import { devSecret } from "./dev-secrets.server";

export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  if (v) return v;
  return devSecret(key);
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}

