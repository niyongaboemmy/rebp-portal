"use client";

import { MoreHorizontal } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRow,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isActivePath, PUBLIC_NAV } from "@/config/navigation";
import { splitLocalePrefix } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Gap between links (gap-1) and between the header's three columns (gap-4). */
const GAP = 4;
const COLUMN_GAP = 16; // sm and up; the nav is hidden below md

const linkClass =
  "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap";

/**
 * Hand-drawn Sun stroke under the label (the project's sketch underline, in miniature). It
 * draws itself in on hover at partial strength; the current page holds it fully drawn.
 */
function NavSketch({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-x-2.5 bottom-0 h-1.5 w-[calc(100%-1.25rem)] text-sun transition-opacity duration-(--dur-3)",
        active
          ? "opacity-100"
          : "opacity-0 group-hover/nav:opacity-70 group-data-[state=open]/nav:opacity-70",
      )}
    >
      <path
        d="M2 6.5C20 3.5 42 2.6 62 3.4 76 4 88 5.2 98 4.2M10 8.6c22-2 52-2.6 80-1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={100}
        strokeDasharray={100}
        className={cn(
          "transition-[stroke-dashoffset] duration-500 ease-(--ease-enter)",
          active
            ? "animate-draw [animation-duration:700ms]"
            : "[stroke-dashoffset:100] group-hover/nav:[stroke-dashoffset:0] group-data-[state=open]/nav:[stroke-dashoffset:0]",
        )}
      />
    </svg>
  );
}

/**
 * Centred priority+ navigation (md and up, UX-001). One-word labels, no icons, a hand-drawn Sun
 * underline for hover and the current page; the full name is the tooltip. The header is a three-column grid (logo · nav · actions). Links that do not fit
 * fold into a "⋯" menu. Widths come from an invisible measuring row, so the fold follows the real label
 * lengths in every language and re-fits on resize or font load. Below md the drawer takes over.
 */
export function HeaderNav() {
  const t = useTranslations("nav");
  const pathname = splitLocalePrefix(usePathname()).path;
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState<number>(PUBLIC_NAV.length);
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    const row = nav?.parentElement;
    const start = nav?.previousElementSibling;
    const end = nav?.nextElementSibling;
    if (!nav || !measure || !row || !start || !end) return;
    const fit = () => {
      const widths = Array.from(measure.children, (el) => el.getBoundingClientRect().width);
      const more = widths.pop() ?? 0;
      // Side cells are content-sized (justify-self), so this is the real free width. The grid
      // centres the nav when both sides allow it and shifts it off-centre only when they don't.
      const style = getComputedStyle(row);
      const available =
        row.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight) -
        start.getBoundingClientRect().width -
        end.getBoundingClientRect().width -
        2 * COLUMN_GAP;
      const total = widths.reduce((sum, w, i) => sum + w + (i ? GAP : 0), 0);
      let next = widths.length;
      if (total > available) {
        let used = more;
        next = 0;
        for (const w of widths) {
          if (used + GAP + w > available) break;
          used += GAP + w;
          next += 1;
        }
      }
      setCount(next);
      setMeasured(true);
    };
    const observer = new ResizeObserver(fit);
    for (const el of [row, start, end, measure]) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const inline = PUBLIC_NAV.slice(0, count);
  const overflow = PUBLIC_NAV.slice(count);
  const overflowActive = overflow.some((item) => isActivePath(pathname, item));
  const label = (item: (typeof PUBLIC_NAV)[number]) => t(`short.${item.label}` as "short.home");

  return (
    <nav
      ref={navRef}
      aria-label={t("mainNavigation")}
      data-measured={measured || undefined}
      className={cn(
        "relative col-start-2 hidden items-center justify-center gap-1 md:flex",
        !measured && "overflow-hidden",
      )}
    >
      {/* Measuring row: same classes as the links, never seen or announced. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex w-max gap-1"
      >
        {PUBLIC_NAV.map((item) => (
          <span key={item.href} className={linkClass}>
            {label(item)}
          </span>
        ))}
        <span className="inline-flex size-9 shrink-0" />
      </div>

      {inline.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={t(item.label)}
          aria-current={isActivePath(pathname, item) ? "page" : undefined}
          className={cn(
            linkClass,
            "group/nav relative text-muted-foreground transition-colors duration-(--dur-2) outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:font-semibold aria-[current=page]:text-foreground",
          )}
        >
          {label(item)}
          <NavSketch active={isActivePath(pathname, item)} />
        </Link>
      ))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("more")}
            className={cn(
              "group/nav relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=open]:text-foreground",
              overflowActive && "text-foreground",
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <NavSketch active={overflowActive} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-52">
            {overflow.map((item) => (
              <DropdownMenuRow
                key={item.href}
                href={item.href}
                icon={<item.icon filled={isActivePath(pathname, item)} />}
                title={label(item)}
                current={isActivePath(pathname, item)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
