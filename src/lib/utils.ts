import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDownloads(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const digits = m >= 100 ? 0 : 1;
    return `${m.toFixed(digits).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    const digits = k >= 100 ? 0 : 1;
    return `${k.toFixed(digits).replace(/\.0$/, "")}k`;
  }
  return n.toLocaleString("en-US");
}

export function formatDownloadsLong(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m.toFixed(1).replace(/\.0$/, "")} million`;
  }
  return formatDownloads(n);
}

export function publicOrigin(request?: Request): string {
  if (request) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  }
  const envOrigin = process.env.PUBLIC_ORIGIN?.trim();
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  return "";
}
