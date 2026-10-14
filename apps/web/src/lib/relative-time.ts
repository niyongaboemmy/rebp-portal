/**
 * "5 min ago"-style labels from the message catalogue rather than Intl.RelativeTimeFormat, whose
 * CLDR data for Kinyarwanda is too thin ("-5 min"). Older than a week falls back to a date.
 */
type Translate = (
  key: "justNow" | "minutes" | "hours" | "days",
  values?: { count: number },
) => string;

export function relativeLabel(
  date: Date,
  now: Date,
  t: Translate,
  formatDate: (date: Date) => string,
): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("days", { count: days });
  return formatDate(date);
}
