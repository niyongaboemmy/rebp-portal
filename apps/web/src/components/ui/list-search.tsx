"use client";

import { Loader2, Search, X } from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";

/**
 * Compact search field for list headers. It searches as you type (debounced) through a query
 * param, so results stay server-side, shareable and paginated; the page resets to 1. Esc or the
 * clear button empties it. Reuse it on any list that reads `?q=` (or another `param`).
 */
export function ListSearch({
  label,
  placeholder,
  clearLabel,
  param = "q",
  className,
}: {
  label: string;
  placeholder: string;
  clearLabel: string;
  param?: string;
  className?: string;
}) {
  const { params, set, pending } = useUrlState();
  const urlValue = params.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const input = useRef<HTMLInputElement>(null);
  const last = useRef(urlValue);

  // Follow the URL when another control (the panel search, a filter pill) changes it.
  useEffect(() => {
    if (urlValue !== last.current) {
      last.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  // Debounced write-back.
  useEffect(() => {
    const next = value.trim();
    if (next === last.current) return;
    const id = setTimeout(() => {
      last.current = next;
      set({ [param]: next || null, spot: null });
    }, 300);
    return () => clearTimeout(id);
  }, [value, param, set]);

  return (
    <div
      role="search"
      className={cn(
        "group/ls relative flex h-9 items-center rounded-full bg-foreground/[0.05] transition-[background-color,box-shadow] duration-(--dur-2) focus-within:bg-card focus-within:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_45%,transparent)] dark:bg-white/[0.06] dark:focus-within:bg-white/[0.08]",
        className,
      )}
    >
      {pending ? (
        <Loader2
          aria-hidden
          className="pointer-events-none absolute left-3 size-4 animate-spin text-link"
        />
      ) : (
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground transition-colors group-focus-within/ls:text-link"
        />
      )}
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            setValue("");
          }
        }}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-full w-full min-w-0 bg-transparent pr-9 pl-9 text-base outline-none placeholder:text-muted-foreground/80 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            input.current?.focus();
          }}
          aria-label={clearLabel}
          className="absolute right-1 inline-flex size-7 animate-pop items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
