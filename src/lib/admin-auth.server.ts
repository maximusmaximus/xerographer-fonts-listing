import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const COOKIE = "xf_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

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

function fromFile(): { username?: string; password?: string } {
  try {
    const raw = readFileSync(new URL("../../.secrets/admin.login", import.meta.url), "utf8");
    const out: { username?: string; password?: string } = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key === "username") out.username = value;
      if (key === "password") out.password = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function adminCredentials(): { username: string; password: string } | null {
  const file = fromFile();
  const username = process.env.ADMIN_USERNAME?.trim() || file.username || "";
  const password = process.env.ADMIN_PASSWORD?.trim() || file.password || "";
  if (!username || !password) return null;
  return { username, password };
}

function sessionSecret(password: string): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || password;
}

export function adminSessionOk(request: Request): boolean {
  const creds = adminCredentials();
  if (!creds) return false;
  const token = readCookie(request, COOKIE);
  return sessionValid(token, sessionSecret(creds.password));
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
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
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
