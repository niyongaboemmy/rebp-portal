"use client";

import { BookUser, Building2, ChevronDown, Layers, MapPin, Users, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { CATEGORIES, CATEGORY_INFO, type Category } from "@rebp/contracts";
import { TIER_TILE } from "@/components/registry/tones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRow,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableMenu } from "@/components/ui/searchable-menu";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";

const STATUSES = ["ACTIVE", "SUSPENDED", "EXPIRED", "REVOKED"] as const;
const STATUS_DOT: Record<(typeof STATUSES)[number], string> = {
  ACTIVE: "bg-success",
  SUSPENDED: "bg-warning",
  EXPIRED: "bg-foreground/35",
  REVOKED: "bg-destructive",
};
const KINDS = ["PERSON", "FIRM"] as const;
const KIND_ICON = { all: Users, PERSON: BookUser, FIRM: Building2 } as const;

/** One look for every facet: soft when idle, solid brand blue with its value when set. */
const pill = (on: boolean) =>
  cn(
    "group flex h-10 w-full min-w-0 items-center gap-2 rounded-2xl px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-[background-color,color,transform,padding] duration-(--dur-2) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.97] [&_svg]:size-3.5 [&_svg]:shrink-0",
    on
      ? "bg-primary pr-8 text-primary-foreground"
      : "bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.08] hover:text-foreground dark:bg-white/[0.06] dark:hover:bg-white/[0.1]",
  );

function Chevron() {
  return (
    <ChevronDown
      aria-hidden
      className="ml-auto opacity-60 transition-transform duration-(--dur-2) group-data-[state=open]:rotate-180"
    />
  );
}

/** Inline × on a set pill; a sibling of the trigger (never nested in it). */
function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={label}
      className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 animate-pop items-center justify-center rounded-full text-primary-foreground/85 transition-colors hover:bg-white/20 hover:text-primary-foreground"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

/**
 * FR-REG-002 register filters as one row of facet pills: Category, Status, Type, District. Idle
 * pills name their facet; a set pill turns brand blue, shows its value and gets its own ×. When
 * anything is set, a summary line shows how many match and offers "Clear all". Every change is
 * mirrored in the URL (shareable, survives reloads); a thin line runs while results update.
 */
export function RegisterFilterBar({
  districts,
  counts,
  total,
}: {
  districts: { code: string; name: string; province: string }[];
  /** Entries per district for the current search (district aside), for the district menu. */
  counts: Record<string, number>;
  /** Entries matching everything currently set. */
  total: number;
}) {
  const t = useTranslations("registerResults");
  const tc = useTranslations("categories");
  const ts = useTranslations("status.licence");
  const { params, set, pending } = useUrlState();

  // Only known values count; anything else in the URL is ignored (the server ignores it too).
  const rawCategory = params.get("category") ?? "";
  const category: Category | "" = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : "";
  const rawStatus = params.get("status") ?? "";
  const status = (STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "";
  const kindParam = params.get("kind");
  const kind = kindParam === "PERSON" || kindParam === "FIRM" ? kindParam : "all";
  const district = params.get("district") ?? "";
  const q = params.get("q") ?? "";
  const activeCount = [category, status, kind !== "all", district, q].filter(Boolean).length;
  const KindIcon = KIND_ICON[kind];
  const remove = (name: string) => t("removeFilter", { filter: name });

  return (
    <div className="relative flex flex-col gap-3">
      {/* Four facets in a tidy 2 × 2 grid: equal widths, nothing orphaned. */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Category */}
        <div className="relative min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={pill(Boolean(category))}
              aria-label={t("facets.category")}
            >
              <Layers />
              <span className="truncate">
                {category ? CATEGORY_INFO[category].abbreviation : t("facets.category")}
              </span>
              {!category && <Chevron />}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[min(26rem,70vh)] w-72 overflow-y-auto"
            >
              <DropdownMenuLabel>{t("facets.category")}</DropdownMenuLabel>
              <DropdownMenuRow
                icon={<Layers />}
                title={t("allCategories")}
                current={!category}
                trailing={null}
                onSelect={() => set({ category: null })}
              />
              <DropdownMenuSeparator />
              {CATEGORIES.map((c) => (
                <DropdownMenuRow
                  key={c}
                  icon={
                    <span
                      className={cn(
                        "inline-flex size-full items-center justify-center rounded-xl text-[0.6rem] font-bold text-white",
                        TIER_TILE[CATEGORY_INFO[c].tier],
                      )}
                    >
                      {CATEGORY_INFO[c].section}
                    </span>
                  }
                  title={tc(`items.${c}.name`)}
                  description={CATEGORY_INFO[c].abbreviation}
                  current={category === c}
                  trailing={null}
                  onSelect={() => set({ category: c })}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {category && (
            <ClearButton
              label={remove(t("facets.category"))}
              onClear={() => set({ category: null })}
            />
          )}
        </div>

        {/* Status */}
        <div className="relative min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger className={pill(Boolean(status))} aria-label={t("facets.status")}>
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full ring-2 ring-white/40",
                  status ? STATUS_DOT[status as (typeof STATUSES)[number]] : "bg-foreground/30",
                )}
              />
              <span className="truncate">{status ? ts(status) : t("facets.status")}</span>
              {!status && <Chevron />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{t("facets.status")}</DropdownMenuLabel>
              <DropdownMenuRow
                icon={<span className="size-2.5 rounded-full bg-foreground/30" />}
                title={t("allStatuses")}
                current={!status}
                trailing={null}
                onSelect={() => set({ status: null })}
              />
              {STATUSES.map((s) => (
                <DropdownMenuRow
                  key={s}
                  icon={<span className={cn("size-2.5 rounded-full", STATUS_DOT[s])} />}
                  title={ts(s)}
                  current={status === s}
                  trailing={null}
                  onSelect={() => set({ status: s })}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {status && (
            <ClearButton label={remove(t("facets.status"))} onClear={() => set({ status: null })} />
          )}
        </div>

        {/* Type */}
        <div className="relative min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger className={pill(kind !== "all")} aria-label={t("kind.label")}>
              <KindIcon />
              <span className="truncate">
                {kind === "all" ? t("facets.kind") : t(`kind.${kind}`)}
              </span>
              {kind === "all" && <Chevron />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{t("kind.label")}</DropdownMenuLabel>
              {(["all", ...KINDS] as const).map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <DropdownMenuRow
                    key={k}
                    icon={<Icon />}
                    title={t(`kind.${k}`)}
                    current={kind === k}
                    trailing={null}
                    onSelect={() => set({ kind: k === "all" ? null : k })}
                  />
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          {kind !== "all" && (
            <ClearButton label={remove(t("facets.kind"))} onClear={() => set({ kind: null })} />
          )}
        </div>

        {/* District (searchable, with counts) */}
        <div className="relative min-w-0">
          <SearchableMenu
            label={t("district.label")}
            value={district}
            onChange={(code) => set({ district: code || null })}
            icon={<MapPin />}
            allLabel={t("district.all")}
            idleLabel={t("facets.district")}
            searchPlaceholder={t("district.search")}
            emptyLabel={(query) => t("district.noMatch", { query })}
            clearLabel={t("district.clear")}
            allCount={Object.values(counts).reduce((a, b) => a + b, 0)}
            options={districts.map((d) => ({
              value: d.code,
              label: d.name,
              group: d.province,
              count: counts[d.code] ?? 0,
            }))}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-2xl px-3 text-[0.8125rem] font-medium [&_svg]:size-3.5 [&>svg:last-child]:ml-auto",
              district
                ? "pr-8 [&>svg:last-child]:hidden"
                : "bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.08] dark:bg-white/[0.06]",
            )}
          />
          {district && (
            <ClearButton
              label={remove(t("facets.district"))}
              onClear={() => set({ district: null })}
            />
          )}
        </div>
      </div>

      {/* Summary: how many match, and one way out. */}
      {activeCount > 0 && (
        <div className="flex animate-rise items-center justify-between gap-3 px-1 text-xs leading-none [animation-duration:var(--dur-3)]">
          <span className="text-muted-foreground" aria-live="polite">
            {t("matching", { count: total })}
          </span>
          <button
            type="button"
            onClick={() =>
              set({ category: null, status: null, kind: null, district: null, q: null, spot: null })
            }
            className="font-semibold text-link hover:underline"
          >
            {t("clearAll")}
          </button>
        </div>
      )}

      {/* Updating… */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-1 -bottom-2 h-0.5 rounded-full bg-[linear-gradient(90deg,transparent,var(--primary),var(--sky),transparent)] bg-[length:200%_100%] transition-opacity duration-(--dur-2)",
          pending ? "animate-[progress-pan_1s_linear_infinite] opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
