"use client";

import { Loader2, Search, X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";

/** Register search (FR-RA-002): licence number, name or registration number, mirrored in the URL. */
export function LicenceSearch() {
  const t = useTranslations("registerAdmin.search");
  const { params, set, pending } = useUrlState();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onSearch = (value: string) => {
    setQuery(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set({ q: value.trim() || null, licence: null }), 300);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          className="pl-10"
        />
        {pending && (
          <Loader2
            className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
      {query && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            set({ q: null, licence: null });
          }}
        >
          <X /> {t("clear")}
        </Button>
      )}
    </div>
  );
}
