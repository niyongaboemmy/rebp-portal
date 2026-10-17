"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  normaliseLicenceNo,
  type Category,
  type LicenseStatus,
  type SectionKey,
} from "@rebp/contracts";
import { Building2, Check, Search, UserCheck, X } from "@/components/icons";
import { LicenceStatusBadge } from "@/components/applications/status-badges";
import { Button } from "@/components/ui/button";
import { Field, FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SELECTED, SURFACE_MUTED } from "@/components/ui/surface";
import { cn, initials } from "@/lib/utils";
import { useSection, useWizard, type FirmOption } from "./context";
import { FieldRules, useRuleSlot } from "./rules-ui";
import { formatRuleValues } from "@/components/eligibility/rule-list";

/**
 * Register lookups for Section F. Firm typeahead (FR-F-002): picking a licensed firm auto-fills
 * its registration number and Principal Broker (F.3–F.6); a firm not yet on the register may be
 * typed in and is flagged "unverified". Supervisor lookup (FR-F-004) shows the register entry so
 * the applicant sees at once whether BR-030 will pass.
 */
export function FirmLookup({
  section,
  idPath,
  namePath,
  allowManual = true,
  label,
}: {
  section: SectionKey;
  idPath: string;
  namePath?: string;
  allowManual?: boolean;
  label: React.ReactNode;
}) {
  const t = useTranslations("wizard.lookup");
  const s = useSection(section);
  const { firm, setFirm } = useWizard();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FirmOption[]>([]);
  // The query the results answer; a different query means a search is on its way.
  const [resultsFor, setResultsFor] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const firmId = s.get(idPath) as string | undefined;
  const shown = query.trim().length >= 2 ? results : [];
  const manualName = namePath ? (s.get(namePath) as string | undefined) : undefined;

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/lookup/firms?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: FirmOption[]) => {
          setResults(data);
          setResultsFor(query);
          setOpen(true);
        })
        // A failed search ends the wait (an abort means the applicant typed on).
        .catch((error: Error) => error.name !== "AbortError" && setResultsFor(query));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const select = (option: FirmOption) => {
    setFirm(option);
    s.patch({
      [idPath]: option.id,
      ...(namePath ? { [namePath]: option.tradingName ?? option.legalName } : {}),
      branchId: undefined,
    } as never);
    setQuery("");
    setOpen(false);
  };
  const clear = () => {
    setFirm(null);
    s.patch({
      [idPath]: undefined,
      ...(namePath ? { [namePath]: undefined } : {}),
      branchId: undefined,
    } as never);
  };

  if (firmId && firm && firm.id === firmId) {
    return (
      <div className="flex flex-col gap-2" data-path={idPath}>
        {/* The group heading already says "Firm"; the label stays for screen readers. */}
        <span className="sr-only">{label}</span>
        <div className={cn("flex items-start gap-3 rounded-2xl p-4", SELECTED)}>
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" aria-hidden />
          </span>
          <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="sr-only">{t("firmName")}</dt>
              <dd className="font-semibold">{firm.tradingName ?? firm.legalName}</dd>
              {firm.tradingName && (
                <dd className="text-xs text-muted-foreground">{firm.legalName}</dd>
              )}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("registration")}</dt>
              <dd className="font-mono text-xs font-semibold">{firm.registrationNo}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("principal")}</dt>
              <dd className="font-medium">
                {firm.principal
                  ? `${firm.principal.displayName} · ${firm.principal.licenceNo}`
                  : t("noPrincipal")}
              </dd>
            </div>
          </dl>
          {!s.disabled && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={clear}
              aria-label={t("change")}
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-link">
          <Check className="size-3.5" aria-hidden /> {t("verifiedShort")}
        </p>
        <FieldRules section={section} path={idPath} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-path={idPath}>
      <Field
        label={label}
        description={t("firmHint")}
        error={s.error(idPath) ?? (namePath ? s.error(namePath) : undefined)}
      >
        <div className="relative">
          <FieldControl>
            <Input
              role="combobox"
              aria-expanded={open && shown.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              value={query}
              disabled={s.disabled}
              placeholder={t("firmPlaceholder")}
              leading={<Search />}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => shown.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
          </FieldControl>
          {open && shown.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute inset-x-0 top-full z-20 mt-1.5 flex max-h-72 flex-col overflow-auto rounded-2xl bg-popover p-1.5 shadow-[0_18px_48px_-16px_oklch(0.3_0.1_264/0.35)] ring-1 ring-foreground/[0.06]"
            >
              {shown.map((option) => (
                <li key={option.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(option)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <Building2 className="size-4 shrink-0 text-link" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold">
                        {option.tradingName ?? option.legalName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {option.registrationNo}
                        {option.principal ? ` · ${option.principal.displayName}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* Searching: options-shaped placeholders where the results will appear (UX-009). */}
          {query.trim().length >= 2 && resultsFor !== query && (
            <div
              role="status"
              className="absolute inset-x-0 top-full z-20 mt-1.5 flex flex-col gap-1 rounded-2xl bg-popover p-1.5 shadow-[0_18px_48px_-16px_oklch(0.3_0.1_264/0.35)] ring-1 ring-foreground/[0.06]"
            >
              <span className="sr-only">{t("searching")}</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5" aria-hidden>
                  <Skeleton className="size-4 rounded" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5" style={{ width: `${60 - i * 12}%` }} />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {open && query.trim().length >= 2 && resultsFor === query && shown.length === 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">{t("noFirm")}</p>
          )}
        </div>
      </Field>
      {allowManual && namePath && (
        <details
          data-path={namePath}
          className="group rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]"
          open={Boolean(manualName && !firmId)}
        >
          <summary className="cursor-pointer text-sm font-medium text-link">{t("manual")}</summary>
          <div className="mt-3 flex flex-col gap-2">
            <Input
              value={manualName ?? ""}
              disabled={s.disabled}
              placeholder={t("manualPlaceholder")}
              aria-label={t("manual")}
              onChange={(e) =>
                s.patch({ [idPath]: undefined, [namePath]: e.target.value || undefined } as never)
              }
            />
            <p className="text-xs text-muted-foreground">{t("manualHint")}</p>
          </div>
        </details>
      )}
      <FieldRules section={section} path={idPath} />
    </div>
  );
}

interface LicenceEntry {
  licenceNo: string;
  displayName: string;
  category: Category;
  status: LicenseStatus;
  firmName: string | null;
}

/** Supervisor (or own Broker licence) lookup by licence number (FR-F-004, G5.1). */
export function LicenceLookup({
  section,
  path,
  label,
  description,
  allowed,
  suggestions = [],
}: {
  section: SectionKey;
  path: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Categories that satisfy the rule (BR-030); the card judges the entry against them. */
  allowed?: readonly Category[];
  /** Register entries offered as one-tap answers (e.g. the firm's Principal Broker). */
  suggestions?: ReadonlyArray<{ displayName: string; licenceNo: string }>;
}) {
  const t = useTranslations("wizard.lookup");
  const tr = useTranslations("rules");
  const tc = useTranslations("categories.items");
  const s = useSection(section);
  const { eligibility, locale } = useWizard();
  const value = (s.get(path) as string | undefined) ?? "";
  const [fetched, setEntry] = useState<LicenceEntry | null | undefined>(undefined);
  // The number the entry answers; a different number means the register is being asked.
  const [fetchedFor, setFetchedFor] = useState("");
  const supervisor = allowed !== undefined;
  // This card is where the supervisor rule speaks (BR-030): claim its slot so it isn't repeated.
  useRuleSlot(supervisor ? `${section}.${path}` : null);
  // A whole number is checked on the register; anything else is a search (UX-023).
  const complete = FULL_NUMBER.test(normaliseLicenceNo(value));
  const [matches, setMatches] = useState<LicenceMatch[]>([]);
  const [matchedFor, setMatchedFor] = useState("");

  useEffect(() => {
    if (complete || value.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: value.trim(),
        categories: (allowed ?? []).join(","),
      });
      fetch(`/api/lookup/licence?${params}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: LicenceMatch[]) => {
          setMatches(data);
          setMatchedFor(value);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, complete, allowed]);

  useEffect(() => {
    if (!complete) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/lookup/licence?no=${encodeURIComponent(normaliseLicenceNo(value))}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: LicenceEntry | null) => {
          setEntry(data);
          setFetchedFor(value);
        })
        .catch((error: Error) => error.name !== "AbortError" && setFetchedFor(value));
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, complete]);

  const checking = complete && fetchedFor !== value;
  const entry = complete && !checking ? fetched : undefined;
  const shownMatches = !complete && matchedFor === value && value.trim().length >= 2 ? matches : [];
  // One verdict, judged at once from the register entry; the server adds what only it knows.
  const server = eligibility.rules.find(
    (r) => r.id === "BR-030" && r.values?.licence === value && r.outcome === "FAIL",
  );
  const verdict: "ok" | "notFound" | "inactive" | "category" | "self" | null = !supervisor
    ? null
    : entry === null
      ? "notFound"
      : !entry
        ? null
        : server?.message === "BR-030.self"
          ? "self"
          : entry.status !== "ACTIVE"
            ? "inactive"
            : !allowed!.includes(entry.category)
              ? "category"
              : "ok";
  const values = formatRuleValues(
    { licence: value, allowed: allowed?.join(",") ?? "", held: entry?.category ?? "" },
    locale,
  );
  const offers = s.disabled ? [] : suggestions.filter((o) => o.licenceNo !== value);
  const suggest = offers.map((option) => (
    <button
      key={option.licenceNo}
      type="button"
      onClick={() => s.set(path, option.licenceNo)}
      className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-primary-soft px-3 text-xs font-semibold text-primary-soft-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      <UserCheck className="size-3.5" aria-hidden />
      {t("useSuggestion", { name: option.displayName, licence: option.licenceNo })}
    </button>
  ));
  const bad = verdict && verdict !== "ok";

  return (
    <div className="flex flex-col gap-2.5" data-path={path}>
      <Field label={label} description={description} error={s.error(path)}>
        <FieldControl>
          <Input
            value={value}
            disabled={s.disabled}
            autoCapitalize="characters"
            placeholder={t("searchPlaceholder")}
            // A name or a number: kept as typed, so a name searches as written.
            onChange={(e) => s.set(path, e.target.value || undefined)}
            // "brk 2022 104" becomes "BRK-2022-00104" when the applicant moves on.
            onBlur={() =>
              complete &&
              value !== normaliseLicenceNo(value) &&
              s.set(path, normaliseLicenceNo(value))
            }
          />
        </FieldControl>
      </Field>
      {/* Typing: matches from the register, and the number's shape (UX-023). */}
      {!complete && value.trim() !== "" && !s.disabled && <NumberGuide value={value} />}
      {shownMatches.length > 0 && (
        <ul aria-label={t("matches")} className="flex flex-col gap-1.5">
          {shownMatches.map((match) => (
            <li key={match.licenceNo}>
              <button
                type="button"
                onClick={() => s.set(path, match.licenceNo)}
                className="group flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 text-left ring-1 ring-foreground/[0.06] transition-[box-shadow,transform] duration-(--dur-2) hover:-translate-y-px hover:shadow-[0_10px_24px_-16px_oklch(0.35_0.15_264/0.5)] hover:ring-primary/30 dark:bg-surface-2/70 dark:ring-white/[0.07]"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground">
                  {initials(match.displayName)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{match.displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tc(`${match.category}.name`)}
                    {match.firmName ? ` · ${match.firmName}` : ""}
                  </span>
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
                  {match.licenceNo}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                  {t("choose")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Nothing entered yet: the one-tap answer (the matches list says it otherwise). */}
      {!entry && !bad && shownMatches.length === 0 && suggest}
      {/* One result card: who it is, one verdict, and the way out when it doesn't fit. */}
      {/* Asking the register: the result card's shape, so nothing moves when it arrives. */}
      {checking && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]"
        >
          <span className="sr-only">{t("checkingLicence")}</span>
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5" aria-hidden>
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      )}
      {(entry || verdict === "notFound") && (
        <div
          aria-live="polite"
          data-licence-result={verdict ?? "info"}
          className={cn(
            "flex flex-col gap-3 rounded-2xl p-3.5 transition-[background-color,box-shadow] duration-(--dur-3)",
            // No outline (UX-007): the verdict tints the panel, red only when it needs a fix.
            bad
              ? "bg-danger-soft/45 dark:bg-destructive/[0.12]"
              : verdict === "ok"
                ? SELECTED
                : SURFACE_MUTED,
          )}
        >
          {entry && (
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                  bad
                    ? "bg-danger-soft text-destructive"
                    : verdict === "ok"
                      ? "bg-primary-soft text-link"
                      : "bg-primary-soft text-primary-soft-foreground",
                )}
              >
                <UserCheck className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{entry.displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {tc(`${entry.category}.name`)}
                  {entry.firmName ? ` · ${entry.firmName}` : ""}
                </span>
              </div>
              {verdict === "ok" || verdict === "category" ? (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    verdict === "ok"
                      ? "bg-primary-soft text-link"
                      : "bg-danger-soft text-destructive",
                  )}
                >
                  {verdict === "ok" ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <X className="size-3.5" aria-hidden />
                  )}
                  {verdict === "ok" ? t("canSupervise") : t("cannotSupervise")}
                </span>
              ) : (
                <LicenceStatusBadge status={entry.status} />
              )}
            </div>
          )}
          {bad && (
            <p className="text-sm leading-snug">
              {verdict !== "category" && (
                <span className="font-medium">
                  {tr(`BR-030.${verdict}` as "BR-030.category", values)}{" "}
                </span>
              )}
              <span className="text-muted-foreground">
                {tr(`BR-030.${verdict}Fix` as "BR-030.categoryFix", values)}
              </span>
            </p>
          )}
          {bad && suggest.length > 0 && <div className="flex flex-wrap gap-2">{suggest}</div>}
        </div>
      )}
      {!supervisor && entry === null && (
        <p className="text-xs font-medium text-link">{t("licenceNotFound")}</p>
      )}
      {!supervisor && <FieldRules section={section} path={path} />}
    </div>
  );
}

type LicenceMatch = {
  licenceNo: string;
  displayName: string;
  category: Category;
  firmName: string | null;
};

/** A whole licence number, e.g. BRK-2022-00104. */
const FULL_NUMBER = /^[A-Z]{2,4}-\d{4}-\d{5}$/;

/**
 * The shape of a licence number as it's typed (UX-023): category · year · number, each part
 * filled as it's typed and the next one highlighted — or, for a name, a hint that the register is
 * being searched.
 */
function NumberGuide({ value }: { value: string }) {
  const t = useTranslations("wizard.lookup");
  const raw = value.trim().toUpperCase();
  // A name ("Eric") searches; the guide is for numbers: digits, a dash, or a short code.
  if (!/[\d-]/.test(raw) && raw.length > 3) return null;
  const parts = /^([A-Z]{1,4})(?:[\s\-_./]*(\d{0,4}))?(?:[\s\-_./]*(\d{0,5}))?$/.exec(raw);
  // Looks like a name, not a number: the search speaks for itself.
  if (!parts || /\s[A-Z]{2,}/.test(raw)) return null;
  const segments = [
    { key: "category", typed: parts[1] ?? "", example: "BRK", full: (parts[1] ?? "").length >= 2 },
    { key: "year", typed: parts[2] ?? "", example: "2022", full: (parts[2] ?? "").length === 4 },
    { key: "number", typed: parts[3] ?? "", example: "00104", full: (parts[3] ?? "").length >= 1 },
  ] as const;
  const next = segments.findIndex((segment) => !segment.full);
  return (
    <div
      role="note"
      aria-label={t("guide")}
      className="flex flex-wrap items-center gap-1.5 text-xs"
    >
      {segments.map((segment, i) => (
        <span key={segment.key} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground">–</span>}
          <span
            className={cn(
              "inline-flex flex-col items-center rounded-lg px-2 py-1 font-mono ring-1 transition-colors duration-(--dur-2)",
              segment.full
                ? "bg-primary-soft text-primary-soft-foreground ring-primary/20"
                : i === next
                  ? "bg-card text-foreground ring-2 ring-primary/50 dark:bg-surface-2"
                  : "bg-card text-muted-foreground ring-foreground/[0.08] dark:bg-surface-2/70",
            )}
          >
            <span className="font-semibold">{segment.typed || segment.example}</span>
            <span className="font-sans text-[0.6rem] tracking-wide uppercase opacity-80">
              {t(`segments.${segment.key}`)}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

/** Whether a typed value is a whole licence number yet. */
export const isWholeLicenceNo = (value: string) => FULL_NUMBER.test(normaliseLicenceNo(value));
