"use client";

import { Loader2, Search, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { APPLICATION_TYPES, CATEGORIES } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Input, inputClass } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";

/** Statuses a reviewer works on (FR-BO-001); the "all" chip clears the filter. */
const STATUS_FILTERS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_CONFIRMATIONS",
  "PENDING_DECISION",
] as const;

/**
 * Queue filters (FR-BO-001): debounced search on reference or applicant, status chips, category
 * and type selects. Everything lives in the URL so a filtered view can be bookmarked and shared.
 */
export function QueueToolbar({ counts }: { counts: Record<string, number> }) {
  const t = useTranslations();
  const { params, set, pending } = useUrlState();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<number | undefined>(undefined);
  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const type = params.get("type") ?? "";
  const hasFilters = Boolean(params.get("q") || status || category || type);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onSearch = (value: string) => {
    setQuery(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set({ q: value.trim() || null }), 300);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 @3xl/main:flex-row @3xl/main:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("queue.search")}
            aria-label={t("queue.search")}
            className="pl-10"
            data-testid="queue-search"
          />
          {pending && (
            <Loader2
              className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 @3xl/main:flex">
          <label className="sr-only" htmlFor="queue-category">
            {t("queue.categoryLabel")}
          </label>
          <select
            id="queue-category"
            value={category}
            onChange={(e) => set({ category: e.target.value || null })}
            className={cn(inputClass, "w-full bg-card @3xl/main:w-56 dark:bg-transparent")}
          >
            <option value="">{t("queue.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.items.${c}.name`)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="queue-type">
            {t("queue.typeLabel")}
          </label>
          <select
            id="queue-type"
            value={type}
            onChange={(e) => set({ type: e.target.value || null })}
            className={cn(inputClass, "w-full bg-card @3xl/main:w-56 dark:bg-transparent")}
          >
            <option value="">{t("queue.allTypes")}</option>
            {APPLICATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`applicationTypes.${value}.name`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ChipRow role="group" aria-label={t("queue.statusLabel")}>
          <Chip selected={!status} onClick={() => set({ status: null })}>
            {t("queue.allStatuses")}
          </Chip>
          {STATUS_FILTERS.map((value) => (
            <Chip key={value} selected={status === value} onClick={() => set({ status: value })}>
              {t(`status.application.${value}`)}
              <span className="num opacity-70">{counts[value] ?? 0}</span>
            </Chip>
          ))}
        </ChipRow>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden shrink-0 sm:inline-flex"
            onClick={() => {
              setQuery("");
              set({ q: null, status: null, category: null, type: null });
            }}
          >
            <X /> {t("queue.clear")}
          </Button>
        )}
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start sm:hidden"
          onClick={() => {
            setQuery("");
            set({ q: null, status: null, category: null, type: null });
          }}
        >
          <X /> {t("queue.clear")}
        </Button>
      )}
    </div>
  );
}
