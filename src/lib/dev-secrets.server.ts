let cached: Record<string, string> | undefined;

function parse(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || key.startsWith("VITE_")) continue;
    const value = trimmed.slice(eq + 1).trim();
    if (value) env[key] = value;
  }
  return env;
}

/** Values from `.secrets/dev.env`, inlined at build time. Host env still wins. */
function fromFile(): Record<string, string> {
  if (cached) return cached;
  cached = {};
  try {
    const mods = import.meta.glob("../../.secrets/dev.env", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;
    for (const text of Object.values(mods)) {
      if (typeof text === "string") Object.assign(cached, parse(text));
    }
  } catch {
    /* no file, or a runtime without import.meta.glob */
  }
  return cached;
}

export function devSecret(key: string): string | undefined {
  const value = fromFile()[key]?.trim();
  return value || undefined;
}
