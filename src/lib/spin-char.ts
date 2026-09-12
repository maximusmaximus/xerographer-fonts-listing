export function spinChar(text: string, seed: string): string {
  const chars = [...text].filter((c) => c.trim());
  if (!chars.length) return "x";
  let n = 0;
  for (const c of seed) n = (n + c.charCodeAt(0)) % chars.length;
  return chars[n] ?? "x";
}
