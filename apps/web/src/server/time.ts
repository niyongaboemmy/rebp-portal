/**
 * Calendar helpers. Licensing dates (eligibility, expiry, SLA) are calendar days in Rwanda
 * (Africa/Kigali, UTC+2, no daylight saving), stored as YYYY-MM-DD or `@db.Date`.
 */
const KIGALI_OFFSET_MS = 2 * 60 * 60_000;

/** Today's date in Kigali, e.g. "2026-10-15". */
export function todayKigali(now: Date = new Date()): string {
  return new Date(now.getTime() + KIGALI_OFFSET_MS).toISOString().slice(0, 10);
}

/** A `@db.Date` value as YYYY-MM-DD. */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → Date at UTC midnight (what Prisma stores for `@db.Date`). */
export function dateOf(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDaysTo(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Adds working days (Mon–Fri) for SLA timers (FR-WF-006). */
export function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added++;
  }
  return result;
}
