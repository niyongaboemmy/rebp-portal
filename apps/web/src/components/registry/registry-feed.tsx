"use client";

import { ArrowUp, Loader2, RotateCcw } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicEntry } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { RegistryRow } from "./registry-row";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "limited"; seconds: number }
  | { kind: "done" };

/** Pages fetched ahead of the end of the list, in pixels. */
const PREFETCH_MARGIN = "480px";

/** The nearest scrolling ancestor (the floating list panel), so the observer watches it. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * FR-REG-002: the register list with infinite scroll. The server renders the first page
 * (crawlable; plain page links remain in <noscript>); the next page loads as the end of the list
 * comes within reach. Controlled: one request at a time, cancelled on unmount, duplicates
 * dropped, a visible "Load more" button for keyboard users and as a fallback, retry on failure,
 * the anti-scraping budget respected (FR-REG-005) with a plain message, and a clear end.
 * Remount it (key) when the query changes.
 */
export function RegistryFeed({
  initial,
  page: startPage,
  pages: initialPages,
  total,
  query,
  firstPageHref,
}: {
  initial: PublicEntry[];
  page: number;
  pages: number;
  total: number;
  /** The current filters as a query string (no `page`). */
  query: string;
  /** Link back to page 1 when the list was opened on a later page. */
  firstPageHref?: string;
}) {
  const t = useTranslations("registerResults");
  const [entries, setEntries] = useState(initial);
  const [page, setPage] = useState(startPage);
  const [pages, setPages] = useState(initialPages);
  const [status, setStatus] = useState<Status>(
    startPage >= initialPages ? { kind: "done" } : { kind: "idle" },
  );
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const loadMore = useCallback(async () => {
    if (busy.current || page >= pages) return;
    busy.current = true;
    setStatus({ kind: "loading" });
    controller.current = new AbortController();
    try {
      const next = page + 1;
      const response = await fetch(`/api/register/list?${query}${query ? "&" : ""}page=${next}`, {
        signal: controller.current.signal,
        headers: { accept: "application/json" },
      });
      const body = await response.json();
      if (!response.ok) {
        const seconds = Number(body?.meta?.retryAfterSeconds);
        setStatus(seconds > 0 ? { kind: "limited", seconds } : { kind: "error" });
        return;
      }
      setEntries((current) => {
        const seen = new Set(current.map((e) => e.licenceNo));
        return [
          ...current,
          ...(body.entries as PublicEntry[]).filter((e) => !seen.has(e.licenceNo)),
        ];
      });
      setPage(body.page);
      setPages(body.pages);
      setStatus(body.page >= body.pages ? { kind: "done" } : { kind: "idle" });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setStatus({ kind: "error" });
    } finally {
      busy.current = false;
    }
  }, [page, pages, query]);

  useEffect(() => () => controller.current?.abort(), []);

  // Find the scrolling panel once mounted.
  useEffect(() => setScroller(scrollParent(sentinel.current)), []);

  // Load when the sentinel nears the end of the panel; only while idle (errors wait for Retry).
  useEffect(() => {
    const el = sentinel.current;
    if (!el || status.kind !== "idle") return;
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) void loadMore();
      },
      { root: scroller, rootMargin: `0px 0px ${PREFETCH_MARGIN} 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scroller, status.kind, loadMore]);

  // "Back to top" appears once the list has been scrolled a screen down.
  useEffect(() => {
    if (!scroller) return;
    const onScroll = () => setScrolled(scroller.scrollTop > scroller.clientHeight);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scroller]);

  // The rate-limit message counts down, then the list can try again.
  useEffect(() => {
    if (status.kind !== "limited") return;
    const id = setTimeout(
      () =>
        setStatus(
          status.seconds <= 1 ? { kind: "idle" } : { kind: "limited", seconds: status.seconds - 1 },
        ),
      1000,
    );
    return () => clearTimeout(id);
  }, [status]);

  return (
    <div className="flex flex-col gap-3">
      {firstPageHref && startPage > 1 && (
        <Link
          href={firstPageHref as Route}
          className="w-fit text-xs font-semibold text-link hover:underline"
        >
          {t("backToStart")}
        </Link>
      )}
      <ol
        className="flex flex-col gap-0.5 rounded-3xl bg-card/70 p-1.5 shadow-[0_1px_2px_oklch(0.3_0.08_264/0.05)] dark:bg-white/[0.03] dark:shadow-none"
        aria-label={t("listLabel")}
        aria-busy={status.kind === "loading"}
      >
        {entries.map((entry, index) => (
          <RegistryRow
            key={entry.licenceNo}
            entry={entry}
            // Each new page staggers in from its own first row.
            index={index % 20}
          />
        ))}
        {status.kind === "loading" &&
          Array.from({ length: 3 }, (_, i) => (
            <li key={`s${i}`} aria-hidden className="flex items-center gap-3.5 px-2.5 py-2.5">
              <span className="size-12 shrink-0 animate-pulse rounded-full bg-foreground/[0.07]" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-3.5 w-2/5 animate-pulse rounded-full bg-foreground/[0.07]" />
                <span className="h-3 w-3/5 animate-pulse rounded-full bg-foreground/[0.05]" />
              </span>
            </li>
          ))}
      </ol>

      {/* Sentinel + controls. */}
      <div ref={sentinel} className="flex min-h-12 flex-col items-center justify-center gap-2 py-2">
        <p className="sr-only" aria-live="polite">
          {t("loadedOf", { shown: entries.length, total })}
        </p>
        {status.kind === "idle" && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground/[0.05] px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground dark:bg-white/[0.06]"
          >
            {t("loadMore")}
            <span className="text-xs font-normal num">
              {t("shownOf", { shown: entries.length, total })}
            </span>
          </button>
        )}
        {status.kind === "loading" && (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-link" aria-hidden />
            {t("loading")}
          </span>
        )}
        {status.kind === "error" && (
          <span
            role="alert"
            className="inline-flex items-center gap-3 text-sm text-muted-foreground"
          >
            {t("loadFailed")}
            <button
              type="button"
              onClick={() => {
                setStatus({ kind: "idle" });
                void loadMore();
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t("retry")}
            </button>
          </span>
        )}
        {status.kind === "limited" && (
          <span role="status" className="text-center text-sm text-muted-foreground">
            {t("loadLimited", { seconds: status.seconds })}
          </span>
        )}
        {status.kind === "done" && entries.length > 0 && (
          <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
            <span aria-hidden className="h-px w-8 bg-foreground/15" />
            {t("endOfList", { total })}
            <span aria-hidden className="h-px w-8 bg-foreground/15" />
          </span>
        )}
      </div>

      {/* Back to top, floating at the bottom of the panel once scrolled. */}
      <button
        type="button"
        onClick={() => scroller?.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label={t("backToTop")}
        className={cn(
          "sticky bottom-2 -mt-10 ml-auto inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_oklch(0.35_0.18_264/0.7)] transition-[opacity,transform] duration-(--dur-3) ease-spring",
          scrolled ? "opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
        )}
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
    </div>
  );
}
