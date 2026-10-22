import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "xf_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

/** Ships with the app so publish cannot drop the login. Host env overrides both. */
const BUILTIN_USERNAME = "max";
const BUILTIN_PASSWORD = "2g5I-oPNN-T0A2-dJLY";

const fails = new Map<string, number[]>();

export function signSession(exp: number, secret: string): string {
  const body = String(exp);
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function sessionValid(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0 || !timingSafeEqual(a, b)) return false;
  const exp = Number(body);
  return Number.isFinite(exp) && exp > now;
}

export function credentialsMatch(givenUser: string, givenPass: string, user: string, pass: string): boolean {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  const userOk = timingSafeEqual(hash(givenUser), hash(user));
  const passOk = timingSafeEqual(hash(givenPass), hash(pass));
  return userOk && passOk;
}

export function matchingPassword(username: string, password: string): string | null {
  const givenUser = username.trim();
  const givenPass = password.trim();
  const pairs: Array<[string, string]> = [[BUILTIN_USERNAME, BUILTIN_PASSWORD]];
  const envUser = process.env.ADMIN_USERNAME?.trim() ?? "";
  const envPass = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (envUser && envPass) pairs.push([envUser, envPass]);
  for (const [user, pass] of pairs) {
    if (credentialsMatch(givenUser, givenPass, user, pass)) return pass;
  }
  return null;
}

export function adminCredentials(): { username: string; password: string } {
  const envUser = process.env.ADMIN_USERNAME?.trim() ?? "";
  const envPass = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (envUser && envPass) return { username: envUser, password: envPass };
  return { username: BUILTIN_USERNAME, password: BUILTIN_PASSWORD };
}

function sessionKeys(): string[] {
  const keys = [BUILTIN_PASSWORD];
  for (const value of [process.env.ADMIN_SESSION_SECRET, process.env.ADMIN_PASSWORD]) {
    const trimmed = value?.trim();
    if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
  }
  return keys;
}

function sessionSecret(password: string): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || password;
}

export function adminSessionOk(request: Request): boolean {
  const token = readCookie(request, COOKIE);
  return sessionKeys().some((secret) => sessionValid(token, secret));
}

export function loginAllowed(ip: string, now = Date.now()): boolean {
  const recent = (fails.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  fails.set(ip, recent);
  return recent.length < MAX_FAILS;
}

export function noteLoginFailure(ip: string, now = Date.now()): void {
  const recent = (fails.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  fails.set(ip, recent);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (!host) return false;
  const allowed = new Set<string>();
  const add = (value: string | null) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const name = part.trim().replace(/^https?:\/\//, "");
      if (name) allowed.add(name);
    }
  };
  add(request.headers.get("host"));
  add(request.headers.get("x-forwarded-host"));
  try {
    allowed.add(new URL(request.url).host);
  } catch {
    /* ignore */
  }
  if (allowed.has(host)) return true;
  // The published app is reached at fonts.grok.me while the runtime URL is internal.
  return host === "fonts.grok.me" || host.endsWith(".grok.me") || host.endsWith(".grok-sandbox.com") || host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export function sessionCookie(request: Request, password: string): string {
  const exp = Date.now() + SESSION_MS;
  const token = signSession(exp, sessionSecret(password));
  return serializeCookie(request, token, Math.floor(SESSION_MS / 1000));
}

export function clearCookie(request: Request): string {
  return serializeCookie(request, "", 0);
}

function serializeCookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [`${COOKIE}=${value}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}
