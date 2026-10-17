"use client";

import { ArrowRight, Loader2, ScanLine, Search, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CATEGORY_INFO } from "@rebp/contracts";
import { useRegistryPreview } from "@/components/registry/registry-preview";
import { STATUS_DOT, TIER_TILE } from "@/components/registry/tones";
import { initials, type PublicEntry } from "@/lib/registry";
import { cn } from "@/lib/utils";

// Camera + scanner UI loads only when the user taps "scan" (NFR-PERF-005).
const QrScannerDialog = dynamic(() => import("./qr-scanner-dialog"), { ssr: false });

const noopSubscribe = () => () => {};

/** Where a scanned QR should go: our own /check URLs keep their path; anything else is a number. */
export function destinationForScan(raw: string, origin: string): string {
  try {
    const url = new URL(raw);
    if (url.origin === origin && /\/check\//.test(url.pathname)) return url.pathname;
  } catch {
    /* not a URL: treat as a licence number */
  }
  return `/check/${encodeURIComponent(raw.trim().toUpperCase())}`;
}

/** Licence and registration numbers (FSL-2025-00121, RP-000017): these go straight to the verdict. */
export const looksLikeNumber = (value: string) =>
  /^[a-z]{2,4}-(\d{4}-)?\d{4,6}$/i.test(value.trim());

/**
 * Register search (FR-REG-002) with live suggestions and a camera QR scanner for licence
 * certificates (FR-REG-004). As you type (2+ characters) a listbox shows up to six matches with
 * avatar, number and status; arrow keys move, Enter opens the highlighted one in the registry
 * preview (or the verification page), and Enter with nothing highlighted runs the full search.
 * The scanner uses the native BarcodeDetector where available; typing a number always works.
 */
export function VerifySearch({
  defaultValue = "",
  className,
  hiddenFields,
  inline = false,
  mode = "register",
  tone = "soft",
  examples,
  examplesLabel,
}: {
  defaultValue?: string;
  className?: string;
  /** Extra query params kept on submit (e.g. the current view). */
  hiddenFields?: Record<string, string | undefined>;
  /** Suggestions push content down instead of floating (for scrolling containers that clip). */
  inline?: boolean;
  /** "verify": a typed licence number opens its verdict directly; names search the register list. */
  mode?: "register" | "verify";
  /** "solid": white with a hairline edge (on tinted page backgrounds); "soft": a tinted pill. */
  tone?: "soft" | "solid";
  /** Rotating example queries shown while the field is empty (e.g. a number, a name, a firm). */
  examples?: string[];
  /** Lead-in for the examples ("Try"). */
  examplesLabel?: string;
}) {
  const t = useTranslations("verify");
  const tr = useTranslations("registry");
  const router = useRouter();
  const preview = useRegistryPreview();
  const listId = useId();
  const [scanning, setScanning] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<PublicEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const [example, setExample] = useState(0);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!examples?.length || focused || value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setExample((i) => i + 1), 2800);
    return () => clearInterval(id);
  }, [examples, focused, value]);
  const canScan = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(window.BarcodeDetector),
    () => false,
  );

  // Debounced suggestions; stale responses are dropped.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      const reset = setTimeout(() => setItems([]), 0);
      return () => clearTimeout(reset);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/register/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: PublicEntry[]) => {
          setItems(data);
          setActive(-1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const choose = (entry: PublicEntry) => {
    setOpen(false);
    setValue(entry.licenceNo);
    preview.open(entry);
    // On the register, a chosen suggestion becomes the search: the URL, list, map and counts
    // follow it (exact number → that entry only), and the map pins it in its district.
    if (mode === "register") {
      const params = new URLSearchParams(window.location.search);
      params.set("q", entry.licenceNo);
      params.set("spot", entry.licenceNo);
      params.delete("page");
      router.replace(`/register?${params.toString()}` as never, { scroll: false });
    }
  };
  const showList = open && value.trim().length >= 2;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (event.key === "Enter" && active >= 0 && items[active]) {
      event.preventDefault();
      choose(items[active]!);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <>
      <div className={cn("relative", className)}>
        <form
          ref={formRef}
          action="/register"
          method="get"
          role="search"
          data-loop={tone === "solid" || undefined}
          aria-label={t("label")}
          onSubmit={(event) => {
            setOpen(false);
            if (mode === "verify" && looksLikeNumber(value)) {
              event.preventDefault();
              router.push(`/check/${encodeURIComponent(value.trim().toUpperCase())}` as never);
            }
          }}
          className={cn(
            // A soft filled pill: no border at rest; on focus it lifts onto the card with a thin
            // primary hairline and a soft shadow (no heavy ring, same shape while suggesting).
            "group/search relative flex items-center gap-0.5 rounded-full bg-foreground/[0.05] py-1 pr-1 pl-3.5 shadow-[inset_0_0_0_1px_transparent] transition-[background-color,box-shadow] duration-(--dur-2) focus-within:bg-card focus-within:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_45%,transparent),0_8px_24px_-12px_oklch(0.35_0.15_264/0.45)] hover:bg-foreground/[0.07] dark:bg-white/[0.06] dark:focus-within:bg-white/[0.08] dark:focus-within:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_55%,transparent),0_10px_28px_-12px_rgb(0_0_0/0.8)] dark:hover:bg-white/[0.08]",
            "h-11",
            tone === "solid" &&
              // A living border: blue, sky and Sun flow around the field (see .search-glow).
              "search-glow",
          )}
        >
          {Object.entries(hiddenFields ?? {}).map(
            ([name, v]) => v && <input key={name} type="hidden" name={name} value={v} />,
          )}
          <span
            aria-hidden
            className="inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors group-focus-within/search:text-link"
          >
            {loading ? (
              <Loader2 className="size-[1.05rem] animate-spin" />
            ) : (
              <Search className="size-[1.05rem]" />
            )}
          </span>
          <input
            name="q"
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              setFocused(true);
            }}
            onBlur={() => {
              setFocused(false);
              setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={onKeyDown}
            aria-label={t("placeholder")}
            placeholder={examples?.length ? "" : t("placeholder")}
            autoComplete="off"
            enterKeyHint="search"
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent px-2.5 text-base outline-none placeholder:text-muted-foreground/80 [&::-webkit-search-cancel-button]:hidden",
              "sm:text-sm",
            )}
          />
          {/* Rotating examples in place of the placeholder (decorative; the field is labelled). */}
          {examples?.length && !value ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-11 flex items-center gap-1 overflow-hidden text-base text-muted-foreground sm:text-sm"
            >
              {examplesLabel}
              <span
                key={example}
                className="animate-[example-in_420ms_var(--ease-enter)_both] font-medium text-foreground/80"
              >
                {examples[example % examples.length]}
              </span>
            </span>
          ) : null}
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setItems([]);
                formRef.current?.querySelector<HTMLInputElement>('input[name="q"]')?.focus();
              }}
              aria-label={t("clear")}
              className="inline-flex size-8 shrink-0 animate-pop items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
          {canScan && (
            <button
              type="button"
              onClick={() => setScanning(true)}
              aria-label={t("scan")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-link"
            >
              <ScanLine className="size-[1.05rem]" aria-hidden />
            </button>
          )}
          <button
            type="submit"
            aria-label={t("submit")}
            className={cn(
              "group/go ml-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[transform,background-color] hover:bg-[color-mix(in_oklch,var(--primary)_86%,black)] active:scale-95",
            )}
          >
            <ArrowRight
              className="size-4 transition-transform group-hover/go:translate-x-0.5"
              aria-hidden
            />
          </button>
        </form>

        {/* Suggestions */}
        {showList && (
          <div
            className={cn(
              "z-40 mt-1.5 animate-rise overflow-hidden rounded-3xl bg-popover p-1.5 shadow-[0_20px_44px_-16px_oklch(0.3_0.12_264/0.45)] backdrop-blur-2xl [animation-duration:var(--dur-2)] dark:shadow-[0_24px_52px_-16px_rgb(0_0_0/0.85)]",
              inline ? "relative" : "absolute inset-x-0 top-full",
            )}
          >
            {items.length > 0 ? (
              <ul
                id={listId}
                role="listbox"
                aria-label={tr("suggestions")}
                className="flex flex-col"
              >
                {items.map((entry, i) => (
                  <li
                    key={entry.licenceNo}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(entry)}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors aria-selected:bg-foreground/[0.05] dark:aria-selected:bg-white/[0.07]"
                  >
                    <span
                      className={cn(
                        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white",
                        TIER_TILE[CATEGORY_INFO[entry.category].tier],
                      )}
                    >
                      {initials(entry.displayName)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{entry.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{entry.licenceNo}</span>
                        {entry.districtName ? ` · ${entry.districtName}` : ""}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        STATUS_DOT[entry.status] ?? "bg-foreground/30",
                      )}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground" id={listId}>
                {loading ? tr("searching") : tr("noMatches")}
              </p>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formRef.current?.requestSubmit()}
              className="mt-1 flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-link transition-colors hover:bg-primary-soft"
            >
              <span className="truncate">{tr("seeAll", { q: value.trim() })}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </button>
          </div>
        )}
      </div>
      {scanning && (
        <QrScannerDialog
          onClose={() => setScanning(false)}
          onResult={(raw) => {
            setScanning(false);
            router.push(destinationForScan(raw, window.location.origin) as never);
          }}
        />
      )}
    </>
  );
}
