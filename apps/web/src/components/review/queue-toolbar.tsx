"use client";

import { Select } from "@/components/ui/select";
import { Loader2, Search, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { APPLICATION_TYPES, CATEGORIES, QUEUE_SORTS, QUEUE_UNASSIGNED } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";
import type { OfficerOption } from "./assign-dialog";

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
 * Queue filters (FR-BO-001): debounced search on reference or applicant, status chips, category,
 * type and assigned-officer selects, and the sort. Everything lives in the URL so a filtered view
 * can be bookmarked and shared.
 */
export function QueueToolbar({
  counts,
  officers,
  selfId,
}: {
  counts: Record<string, number>;
  officers: OfficerOption[];
  selfId: string;
}) {
  const t = useTranslations();
  const { params, set, pending } = useUrlState();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<number | undefined>(undefined);
  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const type = params.get("type") ?? "";
  const officer = params.get("officer") ?? "";
  const sort = params.get("sort") ?? "";
  const hasFilters = Boolean(params.get("q") || status || category || type || officer);

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
          <Select
            id="queue-category"
            value={category ?? ""}
            onChange={(v) => set({ category: v || null })}
            className="w-full @3xl/main:w-56"
            options={[
              { value: "", label: t("queue.allCategories") },
              ...CATEGORIES.map((c) => ({ value: c, label: t(`categories.items.${c}.name`) })),
            ]}
          />
          <label className="sr-only" htmlFor="queue-type">
            {t("queue.typeLabel")}
          </label>
          <Select
            id="queue-type"
            value={type ?? ""}
            onChange={(v) => set({ type: v || null })}
            className="w-full @3xl/main:w-56"
            options={[
              { value: "", label: t("queue.allTypes") },
              ...APPLICATION_TYPES.map((value) => ({
                value,
                label: t(`applicationTypes.${value}.name`),
              })),
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 @3xl/main:flex">
        <label className="sr-only" htmlFor="queue-officer">
          {t("queue.officerLabel")}
        </label>
        <Select
          id="queue-officer"
          value={officer ?? ""}
          onChange={(v) => set({ officer: v || null })}
          className="w-full @3xl/main:w-56"
          data-testid="queue-officer"
          options={[
            { value: "", label: t("queue.allOfficers") },
            { value: QUEUE_UNASSIGNED, label: t("queue.unassigned") },
            ...officers.map((o) => ({
              value: o.id,
              label: o.id === selfId ? t("queue.assign.me", { name: o.fullName }) : o.fullName,
            })),
          ]}
        />
        <label className="sr-only" htmlFor="queue-sort">
          {t("queue.sortLabel")}
        </label>
        <Select
          id="queue-sort"
          value={sort ?? ""}
          onChange={(v) => set({ sort: !v || v === "deadline" ? null : v })}
          className="w-full @3xl/main:w-56"
          data-testid="queue-sort"
          options={QUEUE_SORTS.map((value) => ({
            value: value === "deadline" ? "" : value,
            label: t(`queue.sorts.${value}`),
          }))}
        />
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
              set({ q: null, status: null, category: null, type: null, officer: null });
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
            set({ q: null, status: null, category: null, type: null, officer: null });
          }}
        >
          <X /> {t("queue.clear")}
        </Button>
      )}
    </div>
  );
}
