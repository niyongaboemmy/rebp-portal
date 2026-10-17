"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_SHELL_PREFS, SIDEBAR_WIDTH, type ShellPrefs } from "@rebp/contracts";
import { PanelLeft, type LucideIcon } from "@/components/icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { writeShellPrefs } from "@/lib/shell-prefs-client";
import { cn } from "@/lib/utils";

/*
 * Collapsible sidebar for the authenticated shell (ADR-011, UX-001). Structure follows shadcn's
 * Sidebar; styling is ours. The collapsed look is pure CSS (`sb-collapsed:` in shell.css, keyed
 * on the root's data-sidebar), so the server-rendered first paint is right. JS only resolves the
 * state for ARIA, tooltips and the toggle.
 */

type Tier = "phone" | "medium" | "wide";

interface SidebarContextValue {
  prefs: ShellPrefs;
  setPrefs: (patch: Partial<ShellPrefs>) => void;
  tier: Tier;
  /** Resolved for the current viewport and preference. */
  collapsed: boolean;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  toggle: () => void;
  /** The shell root, for live resizing without re-rendering. */
  rootRef: React.RefObject<HTMLDivElement | null>;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/** Per-surface override: the sheet always shows the expanded look. */
const SurfaceContext = createContext<{ collapsed: boolean; onNavigate?: () => void } | null>(null);

export function useSidebar(): SidebarContextValue {
  const value = useContext(SidebarContext);
  if (!value) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return value;
}

/** The shell's context when inside one (account menu on public pages has none). */
export function useOptionalSidebar(): SidebarContextValue | null {
  return useContext(SidebarContext);
}

/** Whether the surface this component renders in is the icon rail. */
export function useSurfaceCollapsed(): boolean {
  const surface = useContext(SurfaceContext);
  const sidebar = useContext(SidebarContext);
  return surface?.collapsed ?? sidebar?.collapsed ?? false;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Owns the viewer's layout preferences and renders the shell root with them as data attributes.
 * ⌘B / Ctrl+B toggles the sidebar (ignored while typing).
 */
export function SidebarProvider({
  initialPrefs = DEFAULT_SHELL_PREFS,
  className,
  children,
}: {
  initialPrefs?: ShellPrefs;
  className?: string;
  children: React.ReactNode;
}) {
  const [prefs, setPrefsState] = useState(initialPrefs);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // The sheet is open for the page it was opened on, so navigating closes it.
  const [sheetPath, setSheetPath] = useState<string | null>(null);
  const md = useMediaQuery("(min-width: 48rem)");
  const lg = useMediaQuery("(min-width: 64rem)");
  const xl = useMediaQuery("(min-width: 80rem)");
  const tier: Tier = !md ? "phone" : !lg ? "medium" : "wide";
  const collapsed =
    tier === "medium" ||
    (tier === "wide" && (prefs.sidebar === "collapsed" || (prefs.sidebar === "auto" && !xl)));

  const setPrefs = useCallback((patch: Partial<ShellPrefs>) => {
    setPrefsState(writeShellPrefs(patch));
  }, []);

  // The sheet belongs to the medium tier only.
  // A different page (or leaving the medium tier) closes it for good, so coming back to the page it
  // was opened on doesn't reopen it. Adjusted during render: derived from props, not an effect.
  if (sheetPath !== null && (sheetPath !== pathname || tier !== "medium")) setSheetPath(null);
  const sheetOpen = tier === "medium" && sheetPath === pathname;
  const setSheetOpen = useCallback(
    (open: boolean) => setSheetPath(open ? pathname : null),
    [pathname],
  );

  const toggle = useCallback(() => {
    if (tier === "medium") setSheetOpen(!sheetOpen);
    else if (tier === "wide") setPrefs({ sidebar: collapsed ? "expanded" : "collapsed" });
  }, [tier, collapsed, sheetOpen, setSheetOpen, setPrefs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditable(event.target)) return;
      if (tier === "phone") return; // nothing to toggle: leave the browser's own ⌘B alone
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tier, toggle]);

  const value = useMemo(
    () => ({ prefs, setPrefs, tier, collapsed, sheetOpen, setSheetOpen, toggle, rootRef }),
    [prefs, setPrefs, tier, collapsed, sheetOpen, setSheetOpen, toggle],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        ref={rootRef}
        data-sidebar={prefs.sidebar}
        data-density={prefs.density}
        data-width={prefs.width}
        // The viewer's sidebar width, rendered on the server so the first paint is right.
        style={{ "--sidebar-w": `${prefs.sidebarWidth}px` } as React.CSSProperties}
        className={className}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

/**
 * The sidebar column (≥ md). At the medium tier the trigger opens the same content as a modal
 * sheet; it closes on navigation.
 */
export function Sidebar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("shell");
  const { sheetOpen, setSheetOpen } = useSidebar();

  return (
    <>
      <div
        id="app-sidebar"
        style={{ viewTransitionName: "app-sidebar" }}
        className={cn(
          "group/sidebar sticky top-0 hidden h-dvh w-(--sidebar-w) shrink-0 flex-col overflow-x-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-(--dur-3) ease-standard in-data-resizing:transition-none motion-reduce:transition-none md:flex md:[--sidebar-inset:0.5rem] print:hidden sb-collapsed:w-(--sidebar-w-icon)",
          className,
        )}
      >
        {children}
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          id="app-sidebar-sheet"
          side="left"
          className="gap-0 bg-sidebar p-0"
          // Opened programmatically, so Radix has no trigger to refocus: return focus to ◧.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector<HTMLElement>("[data-sidebar-trigger]")?.focus();
          }}
        >
          <SheetTitle className="sr-only">{t("navigation")}</SheetTitle>
          <SheetDescription className="sr-only">{t("navigationHint")}</SheetDescription>
          <SurfaceContext.Provider
            value={{ collapsed: false, onNavigate: () => setSheetOpen(false) }}
          >
            <div className="flex h-full flex-col">{children}</div>
          </SurfaceContext.Provider>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Logo row; the same height as the top bar so both share a baseline. */
export function SidebarHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-3 px-3 pt-[calc((var(--header-h)-2.25rem)/2+var(--sidebar-inset,0px))] pb-2 sb-collapsed:items-center sb-collapsed:px-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Scrolls on its own so the footer (identity card) stays in view. */
export function SidebarContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-3 sb-collapsed:items-center sb-collapsed:gap-3 sb-collapsed:px-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SidebarFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1 border-t border-border/70 p-3 sb-collapsed:items-center sb-collapsed:px-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A labelled group of destinations. The label is visually hidden on the rail. */
export function SidebarGroup({
  label,
  children,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Unique per render: the sheet renders a second copy of the nav.
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={label ? labelId : undefined}
      className="flex w-full flex-col gap-1 sb-collapsed:before:mx-auto sb-collapsed:before:mb-2 sb-collapsed:before:block sb-collapsed:before:h-px sb-collapsed:before:w-6 sb-collapsed:before:bg-border sb-collapsed:first:before:hidden"
    >
      {label && (
        <p
          id={labelId}
          className="px-3 pb-1 text-xs font-medium text-muted-foreground sb-collapsed:sr-only"
        >
          {label}
        </p>
      )}
      <ul className="flex flex-col gap-0.5 sb-collapsed:items-center">{children}</ul>
    </div>
  );
}

interface SidebarMenuButtonProps {
  href: Route;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Something is waiting here: a count pill expanded, a dot on the rail. */
  badge?: { count: number; label: string };
  onNavigate?: () => void;
}

/**
 * One destination. Expanded: icon, label and count. Rail: icon with a tooltip; the label stays
 * in the accessible name (sr-only), and so does the count ("Work queue, 4 waiting").
 */
export function SidebarMenuButton({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onNavigate,
}: SidebarMenuButtonProps) {
  const collapsed = useSurfaceCollapsed();
  const surfaceNavigate = useContext(SurfaceContext)?.onNavigate;
  const hasBadge = Boolean(badge && badge.count > 0);

  return (
    <li className="w-full sb-collapsed:w-auto">
      {/* Content exists only on the rail. disableHoverableContent: close on leave even when there is
          no content to hover (Radix's grace area would otherwise keep it "open" while expanded). */}
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>
          <Link
            href={href}
            onClick={() => {
              onNavigate?.();
              surfaceNavigate?.();
            }}
            aria-current={active ? "page" : undefined}
            // With a count the name becomes "Work queue, 4 waiting" (it starts with the visible label).
            aria-label={hasBadge ? `${label}, ${badge!.label}` : undefined}
            className="group/item relative flex h-(--nav-item-h,2.75rem) w-full items-center gap-3 rounded-[1rem] px-3.5 text-sm font-medium text-sidebar-foreground/80 transition-colors duration-(--dur-2) outline-none hover:bg-foreground/[0.05] hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-foreground dark:hover:bg-white/[0.05] pointer-coarse:h-11 sb-collapsed:size-11 sb-collapsed:justify-center sb-collapsed:px-0"
          >
            <span className="relative inline-flex shrink-0">
              {/* Outline icons throughout (Fluent 2 Regular at a medium weight); the current page's
                  icon is brand blue on the soft pill, its label stays dark for full contrast. */}
              <Icon
                aria-hidden
                className="size-5 text-sidebar-foreground/80 group-hover/item:text-sidebar-foreground group-aria-[current=page]/item:text-link"
              />
              {hasBadge && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-1 hidden size-2 rounded-full bg-ember ring-2 ring-sidebar forced-colors:bg-[CanvasText] sb-collapsed:block"
                />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate sb-collapsed:sr-only">{label}</span>
            {hasBadge && (
              <>
                <span
                  aria-hidden
                  className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary-soft px-1.5 text-[0.7rem] leading-5 font-semibold num text-primary-soft-foreground sb-collapsed:hidden"
                >
                  {badge!.count > 99 ? "99+" : badge!.count}
                </span>
              </>
            )}
          </Link>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right" sideOffset={10}>
            {label}
            {hasBadge && <span className="text-background/70"> · {badge!.label}</span>}
          </TooltipContent>
        )}
      </Tooltip>
    </li>
  );
}

/** ◧ Collapses or expands the sidebar (≥ 64rem), or opens it as a sheet (48–64rem). */
export function SidebarTrigger({ className }: { className?: string }) {
  const t = useTranslations("shell");
  const { tier, collapsed, sheetOpen, toggle } = useSidebar();
  const label =
    tier === "medium" ? t("openNavigation") : collapsed ? t("expandSidebar") : t("collapseSidebar");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          data-sidebar-trigger
          aria-controls={tier === "medium" ? "app-sidebar-sheet" : "app-sidebar"}
          aria-expanded={tier === "medium" ? sheetOpen : !collapsed}
          aria-keyshortcuts="Meta+B Control+B"
          className={cn(
            "hidden size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-(--dur-2) outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95 md:inline-flex",
            className,
          )}
        >
          <PanelLeft className="size-5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label} <kbd className="ml-1 font-mono opacity-70">⌘B</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

const clampWidth = (px: number) =>
  Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, px)));

/**
 * The sidebar's inner edge (≥ 64rem): drag to resize, double-click to reset, click to collapse
 * or expand, and dragging well past the minimum collapses it. Keyboard: a window-splitter
 * separator (WAI-ARIA APG): ←/→ resize, Home/End jump to the limits, Enter collapses or expands.
 */
export function SidebarRail() {
  const t = useTranslations("shell");
  const { tier, collapsed, toggle, prefs, setPrefs, rootRef } = useSidebar();
  const drag = useRef<{ startX: number; startWidth: number; moved: boolean } | null>(null);
  // A click toggles after a beat, so a double-click (reset width) doesn't collapse and re-expand.
  const clickTimer = useRef<number | null>(null);
  useEffect(() => () => window.clearTimeout(clickTimer.current ?? undefined), []);
  if (tier !== "wide") return null;

  const preview = (px: number) => rootRef.current?.style.setProperty("--sidebar-w", `${px}px`);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: prefs.sidebarWidth, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || collapsed) return;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) < 3) return;
    state.moved = true;
    rootRef.current?.setAttribute("data-resizing", "");
    preview(clampWidth(state.startWidth + dx));
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    rootRef.current?.removeAttribute("data-resizing");
    if (!state) return;
    if (!state.moved) {
      if (clickTimer.current !== null) {
        // Second click of a double-click: the dblclick handler resets the width instead.
        window.clearTimeout(clickTimer.current);
        clickTimer.current = null;
        return;
      }
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null;
        toggle();
      }, 250);
      return;
    }
    const raw = state.startWidth + (event.clientX - state.startX);
    // Dragged well past the minimum: collapse to the rail, keeping the last good width.
    if (raw < SIDEBAR_WIDTH.min - 48) {
      preview(state.startWidth);
      return setPrefs({ sidebar: "collapsed" });
    }
    setPrefs({ sidebarWidth: clampWidth(raw), sidebar: "expanded" });
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -16, ArrowRight: 16 }[event.key as "ArrowLeft" | "ArrowRight"];
    let next: number | null = null;
    if (step) next = clampWidth(prefs.sidebarWidth + step);
    else if (event.key === "Home") next = SIDEBAR_WIDTH.min;
    else if (event.key === "End") next = SIDEBAR_WIDTH.max;
    else if (event.key === "Enter") {
      event.preventDefault();
      return toggle();
    }
    if (next === null || collapsed) return;
    event.preventDefault();
    preview(next);
    setPrefs({ sidebarWidth: next, sidebar: "expanded" });
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("resizeSidebar")}
      aria-controls="app-sidebar"
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      aria-valuenow={collapsed ? SIDEBAR_WIDTH.min : prefs.sidebarWidth}
      tabIndex={0}
      title={t("resizeHint")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        // Gesture interrupted (OS gesture, lost capture): put back the width it started from.
        if (drag.current) preview(drag.current.startWidth);
        drag.current = null;
        rootRef.current?.removeAttribute("data-resizing");
      }}
      onDoubleClick={() => {
        if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
        clickTimer.current = null;
        preview(SIDEBAR_WIDTH.default);
        setPrefs({ sidebarWidth: SIDEBAR_WIDTH.default, sidebar: "expanded" });
      }}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 right-0 z-10 hidden w-2 cursor-ew-resize touch-none outline-none select-none before:absolute before:-inset-x-2 before:inset-y-0 after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-transparent after:transition-colors hover:after:bg-border focus-visible:after:w-0.5 focus-visible:after:bg-ring lg:block"
    />
  );
}
