/** Cutoff math. All customer-facing clock times are America/Los_Angeles. */

const TZ = "America/Los_Angeles";

function ptParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** UTC instant for a wall-clock time in PT (handles PDT/PST). */
export function ptWallToUtc(y: number, m: number, d: number, h: number, min = 0): Date {
  // Start from the UTC guess, then correct by the zone offset at that instant (twice, for DST edges).
  let t = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i += 1) {
    const p = ptParts(new Date(t));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    t += Date.UTC(y, m - 1, d, h, min) - asUtc;
  }
  return new Date(t);
}

/** The next 16:00 PT strictly after `paidAt`. */
export function cancelDeadlineFor(paidAt: Date): Date {
  const p = ptParts(paidAt);
  const today = ptWallToUtc(p.y, p.m, p.d, 16);
  if (paidAt.getTime() < today.getTime()) return today;
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  return ptWallToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 16);
}

/** True at or after 16:00 PT today. */
export function isAfterTodayCutoff(now: Date): boolean {
  const p = ptParts(now);
  return now.getTime() >= ptWallToUtc(p.y, p.m, p.d, 16).getTime();
}

/** Next 02:15 UTC strictly after `now` (just after RPI's nightly 02:00 UTC charge). */
export function nextPostChargeRunUtc(now: Date): Date {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 15));
  if (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

/** Most recent 02:00 UTC at or before `now` (start of the daily cap window). */
export function capWindowStart(now: Date): Date {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0));
  if (t.getTime() > now.getTime()) t.setUTCDate(t.getUTCDate() - 1);
  return t;
}

export function formatPt(d: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(d) + " PT"
  );
}

/** Midnight PT at the start of the PT calendar day containing `now` (the buyer-facing daily cap day). */
export function ptDayStart(now: Date): Date {
  const p = ptParts(now);
  return ptWallToUtc(p.y, p.m, p.d, 0);
}
