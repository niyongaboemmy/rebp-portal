"use client";

import { Select } from "@/components/ui/select";
import { Loader2, Search, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ROLES, USER_STATUS_FILTERS } from "@rebp/contracts";
import { PILL_TRACK, pillClassName } from "@/components/admin/surfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";

/** Search (debounced) + role and status filters, all mirrored in the URL. */
export function PeopleToolbar() {
  const t = useTranslations();
  const { params, set, pending } = useUrlState();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<number | undefined>(undefined);
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "all";
  const hasFilters = Boolean(params.get("q") || role || (status && status !== "all"));

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onSearch = (value: string) => {
    setQuery(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set({ q: value.trim() || null }), 300);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("access.people.search")}
            aria-label={t("access.people.search")}
            className="pl-10"
          />
          {pending && (
            <Loader2
              className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
        </div>
        <label className="sr-only" htmlFor="role-filter">
          {t("access.people.roleLabel")}
        </label>
        <Select
          id="role-filter"
          value={role ?? ""}
          onChange={(v) => set({ role: v || null })}
          className="w-full @2xl/main:w-56"
          options={[
            { value: "", label: t("access.people.allRoles") },
            ...ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) })),
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className={PILL_TRACK} role="group" aria-label={t("access.people.statusLabel")}>
          {USER_STATUS_FILTERS.map((value) => {
            const active = status === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => set({ status: value === "all" ? null : value })}
                className={pillClassName(active)}
              >
                {t(`access.people.status.${value}`)}
              </button>
            );
          })}
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setQuery("");
              set({ q: null, role: null, status: null });
            }}
          >
            <X /> {t("access.people.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
