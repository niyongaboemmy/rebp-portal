import { isAuditCategory, type AuditCategory } from "@/config/audit-actions";

/**
 * Audit trail search (FR-AUD-004): the filters an auditor can combine, parsed from the URL so the
 * page, its paging links and the signed export all read the same query. Pure (no database), so
 * the parsing rules are unit-tested.
 */
export interface AuditFilters {
  /** Actor name or email (case-insensitive, contains). */
  actor?: string;
  /** Entity type, entity id or reference ("Application", "REBP-2026-000123", "Type:id"). */
  entity?: string;
  /** Action prefix or fragment, e.g. "config." or "exported". */
  action?: string;
  category?: AuditCategory;
  /** Kigali calendar days, inclusive (YYYY-MM-DD). */
  from?: string;
  to?: string;
}

export const AUDIT_FILTER_KEYS = ["actor", "entity", "action", "category", "from", "to"] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 120;

function text(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, MAX_TEXT);
  return trimmed || undefined;
}

function day(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw || !DAY.test(raw)) return undefined;
  // Reject impossible dates such as 2026-02-31.
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw
    ? raw
    : undefined;
}

/** Reads the filters from search params; unknown or malformed values are dropped. */
export function parseAuditFilters(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): AuditFilters {
  const get = (key: string) =>
    params instanceof URLSearchParams ? (params.get(key) ?? undefined) : params[key];
  let from = day(get("from"));
  let to = day(get("to"));
  // A reversed range is almost always a slip: swap rather than return nothing.
  if (from && to && from > to) [from, to] = [to, from];
  const category = text(get("category"));
  const filters: AuditFilters = {
    actor: text(get("actor")),
    entity: text(get("entity")),
    action: text(get("action")),
    category: isAuditCategory(category) ? category : undefined,
    from,
    to,
  };
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined),
  ) as AuditFilters;
}

/** Kigali is UTC+2 all year: a Kigali day starts at 22:00 UTC the day before. */
export function kigaliDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+02:00`);
}

/** The UTC instant range [gte, lt) covered by the filters' Kigali days. */
export function occurredRange(filters: Pick<AuditFilters, "from" | "to">): {
  gte?: Date;
  lt?: Date;
} {
  const range: { gte?: Date; lt?: Date } = {};
  if (filters.from) range.gte = kigaliDayStart(filters.from);
  if (filters.to) range.lt = new Date(kigaliDayStart(filters.to).getTime() + 86_400_000);
  return range;
}

/** Entity search: "Type:id" targets both columns; otherwise either column may match. */
export function entityTerms(entity: string): { type?: string; id?: string; any?: string } {
  const colon = entity.indexOf(":");
  if (colon > 0 && colon < entity.length - 1)
    return { type: entity.slice(0, colon).trim(), id: entity.slice(colon + 1).trim() };
  return { any: entity };
}

export function hasFilters(filters: AuditFilters): boolean {
  return AUDIT_FILTER_KEYS.some((k) => filters[k] !== undefined);
}

/** Query string for the filters plus optional extras (cursor, format). */
export function filterQuery(
  filters: AuditFilters,
  extra: Record<string, string | undefined> = {},
): string {
  const query = new URLSearchParams();
  for (const key of AUDIT_FILTER_KEYS) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
  return query.toString();
}
