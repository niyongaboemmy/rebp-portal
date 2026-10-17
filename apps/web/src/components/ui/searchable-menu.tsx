"use client";

import { Check, ChevronDown, Search, SearchX, X } from "@/components/icons";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRow,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  /** Group heading shown while not searching (e.g. the province of a district). */
  group?: string;
  /** Extra words that also match (e.g. the group name). */
  keywords?: string;
  /** Optional count shown at the end of the row (e.g. entries per district); 0 is dimmed. */
  count?: number;
}

/** Case- and accent-insensitive text for matching ("Rubavu" ≈ "rubavú"). */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** The matched part of a label in bold, so the eye finds it at once. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? fold(text).indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-sun/40 px-px text-inherit">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "min-w-6 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[0.7rem] leading-4 font-semibold num",
        value > 0
          ? "bg-primary-soft text-primary-soft-foreground dark:bg-white/[0.08] dark:text-foreground"
          : "text-muted-foreground/60",
      )}
    >
      {value}
    </span>
  );
}

/** Count and/or the selected tick, side by side. */
function Trailing({ count, selected }: { count?: number; selected: boolean }) {
  if (count === undefined) return selected ? <Selected /> : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Count value={count} />
      {selected && <Selected />}
    </span>
  );
}

function Selected() {
  return (
    <span
      aria-hidden
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary"
    >
      <Check className="size-3! text-primary-foreground!" strokeWidth={3} />
    </span>
  );
}

/**
 * The rich select (DropdownMenu + DropdownMenuRow) with a search field for long lists. Same pill
 * trigger, panel and rows as every other menu. Grouped while browsing, flat while searching;
 * focus starts in the field, ↓ moves into the list, Esc closes. The menu's type-to-jump is
 * suppressed while typing so letters go to the field.
 */
export function SearchableMenu({
  label,
  value,
  options,
  onChange,
  icon,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
  allCount,
  idleLabel,
  className,
  contentClassName,
}: {
  /** Accessible name of the trigger and the panel heading. */
  label: string;
  /** Selected value; "" means "all". */
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  icon: React.ReactNode;
  /** The "no filter" row and the trigger text when nothing is selected. */
  allLabel: string;
  searchPlaceholder: string;
  /** Shown when nothing matches; receives the query. */
  emptyLabel: (query: string) => React.ReactNode;
  clearLabel: string;
  /** Count for the "all" row when options carry counts. */
  allCount?: number;
  /** Trigger text while nothing is chosen (defaults to `allLabel`), e.g. the facet name. */
  idleLabel?: string;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Collision handling is off (so the panel never flips above the trigger), so pick the side
  // to align with from where the trigger sits: left half → start, right half → end.
  const [align, setAlign] = useState<"start" | "end">("end");
  const current = options.find((o) => o.value === value);
  const q = fold(query);

  const matches = useMemo(
    () =>
      q
        ? options.filter((o) => fold(`${o.label} ${o.group ?? ""} ${o.keywords ?? ""}`).includes(q))
        : options,
    [options, q],
  );
  const groups = useMemo(() => {
    const map = new Map<string, SearchableOption[]>();
    for (const option of matches) {
      const key = q ? "" : (option.group ?? "");
      map.set(key, [...(map.get(key) ?? []), option]);
    }
    return [...map.entries()];
  }, [matches, q]);

  // Focus the field once the panel has mounted (Radix focuses the panel itself first).
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const choose = (next: string) => {
    onChange(next);
    setQuery("");
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        const box = trigger.current?.getBoundingClientRect();
        if (next && box)
          setAlign(box.left + box.width / 2 < window.innerWidth / 2 ? "start" : "end");
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger
        ref={trigger}
        aria-label={current ? `${label}: ${current.label}` : label}
        className={cn(
          "group inline-flex h-10 max-w-full shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 [&_svg]:size-4 [&_svg]:shrink-0",
          current
            ? "bg-primary text-primary-foreground"
            : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground dark:bg-white/[0.06]",
          className,
        )}
      >
        {icon}
        <span className="truncate">{current?.label ?? idleLabel ?? allLabel}</span>
        <ChevronDown
          className="opacity-70 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side="bottom"
        // Stay below the trigger and shrink to the room left on screen (short phones), instead of
        // flipping above it where the header would clip the panel.
        avoidCollisions={false}
        className={cn(
          "flex max-h-[calc(var(--radix-dropdown-menu-content-available-height)-0.75rem)] w-[min(18rem,calc(100vw-1.5rem))] flex-col p-0",
          contentClassName,
        )}
      >
        <div className="flex flex-col gap-1 border-b border-foreground/[0.07] p-2">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Letters belong to the field, not to the menu's type-to-jump; ↓, Tab and Esc
              // still reach the menu so the keyboard can move into the list or close it.
              onKeyDown={(e) => {
                if (!["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(e.key)) e.stopPropagation();
                if (e.key === "Enter" && matches.length === 1) {
                  e.preventDefault();
                  choose(matches[0]!.value);
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
              enterKeyHint="search"
              className="h-10 w-full rounded-xl bg-foreground/[0.05] pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 dark:bg-white/[0.06] [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  input.current?.focus();
                }}
                aria-label={clearLabel}
                className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[22rem] min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {!q && (
            <>
              <DropdownMenuRow
                icon={icon}
                title={allLabel}
                current={!value}
                trailing={<Trailing count={allCount} selected={!value} />}
                onSelect={() => choose("")}
              />
              <DropdownMenuSeparator />
            </>
          )}
          {groups.map(([group, items]) => (
            <Fragment key={group || "all"}>
              {group && <DropdownMenuLabel className="pt-2.5">{group}</DropdownMenuLabel>}
              {items.map((option) => (
                <DropdownMenuRow
                  key={option.value}
                  icon={icon}
                  title={<Highlight text={option.label} query={q} />}
                  description={q && option.group ? option.group : undefined}
                  current={option.value === value}
                  trailing={<Trailing count={option.count} selected={option.value === value} />}
                  onSelect={() => choose(option.value)}
                />
              ))}
            </Fragment>
          ))}
          {matches.length === 0 && (
            <p
              role="status"
              className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground"
            >
              <SearchX className="size-5" aria-hidden />
              {emptyLabel(query.trim())}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
