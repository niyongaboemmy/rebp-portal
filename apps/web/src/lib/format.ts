/**
 * Display formatting shared by server and client components. Money is in whole Rwandan francs
 * (no minor unit); calendar dates are shown in Africa/Kigali.
 */
export function formatMoney(amount: number, currency = "RWF", locale = "en"): string {
  return new Intl.NumberFormat(locale === "rw" ? "en" : locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A `@db.Date` or ISO day as a medium date, e.g. "15 Oct 2026". */
export function formatDay(value: Date | string, locale = "en"): string {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T12:00:00Z`) : value;
  return new Intl.DateTimeFormat(locale === "rw" ? "en-GB" : locale, {
    dateStyle: "medium",
    timeZone: "Africa/Kigali",
  }).format(date);
}

export function formatDateTime(value: Date | string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "rw" ? "en-GB" : locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kigali",
  }).format(typeof value === "string" ? new Date(value) : value);
}

/** Whole days from today (Kigali) to a date; negative when in the past. */
export function daysUntil(value: Date | string, now = new Date()): number {
  const target = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  const today = new Date(
    new Date(now.getTime() + 2 * 3_600_000).toISOString().slice(0, 10) + "T00:00:00Z",
  );
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
