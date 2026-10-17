"use client";

import { Check, ChevronDown, Loader2, Search, SearchX } from "@/components/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { fold } from "./searchable-menu";
import { cn } from "@/lib/utils";

export interface RichOption {
  value: string;
  label: string;
}

/** Long lists get a search field (letters filter as you type). */
const SEARCH_FROM = 8;

/**
 * Form select in the design system's rich-menu look (the same frosted panel and rows as every
 * other menu), sized and styled like a text input. The trigger is a real button that receives
 * the field's id, aria-invalid and aria-describedby (FieldControl), so the label reads it.
 * The chosen row shows a tick; long lists can be searched; ↑/↓ and Enter work as in any menu.
 */
export function RichSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  loading = false,
  loadingLabel = "Loading…",
  searchPlaceholder = "Search",
  emptyLabel = "No match",
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange" | "value"> & {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: RichOption[];
  placeholder?: string;
  /** Options are on their way: a spinner and "Loading…", not openable. */
  loading?: boolean;
  loadingLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.value === value);
  const searchable = options.length >= SEARCH_FROM;
  const q = fold(query);
  const matches = useMemo(
    () => (q ? options.filter((o) => fold(o.label).includes(q)) : options),
    [options, q],
  );

  useEffect(() => {
    if (!open || !searchable) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, searchable]);

  return (
    // Non-modal: the rest of the form stays reachable and scrollable while it is open.
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
        className={cn(
          "group flex h-12 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3.5 text-left text-base transition-[border-color,box-shadow] outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/15 data-[state=open]:border-ring data-[state=open]:ring-4 data-[state=open]:ring-ring/15 sm:text-sm",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            (!current || loading) && "text-muted-foreground",
          )}
        >
          {loading ? loadingLabel : (current?.label ?? placeholder ?? "—")}
        </span>
        {loading ? (
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-link" />
        ) : (
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        // Opens below, or above when the field sits low on the screen.
        collisionPadding={12}
        className="flex max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-(--radix-dropdown-menu-trigger-width) min-w-56 flex-col p-0"
      >
        {searchable && (
          <div className="relative border-b border-foreground/[0.07] p-2">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (!["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(e.key)) e.stopPropagation();
                if (e.key === "Enter" && matches.length === 1) {
                  e.preventDefault();
                  onChange(matches[0]!.value);
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
              className="h-10 w-full rounded-xl bg-foreground/[0.05] pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground dark:bg-white/[0.06] [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        )}
        <div className="max-h-[20rem] min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {matches.map((o) => {
            const on = o.value === value;
            return (
              <DropdownMenuItem
                key={o.value}
                onSelect={() => onChange(o.value)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm",
                  on && "font-semibold text-link",
                )}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {on && (
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Check className="size-3! text-primary-foreground!" strokeWidth={3} />
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
          {matches.length === 0 && (
            <p className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
              <SearchX className="size-5" aria-hidden />
              {emptyLabel}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
