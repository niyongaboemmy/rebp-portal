"use client";

import { MoreHorizontal } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isActivePath, PUBLIC_NAV } from "@/config/navigation";
import { splitLocalePrefix } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Gap between links (gap-0.5). */
const GAP = 2;

const linkClass =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap";

/**
 * Priority+ navigation (md and up, UX-001). Every label stays on one line; links that do not
 * fit the space left between the logo and the actions fold into a "⋯" menu. Widths come from
 * an invisible measuring row, so the fold follows the real label lengths in every language and
 * re-fits on resize or font load. Below md the drawer (MobileNav) takes over.
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
    if (!nav || !measure) return;
    const fit = () => {
      const widths = Array.from(measure.children, (el) => el.getBoundingClientRect().width);
      const more = widths.pop() ?? 0;
      const available = nav.clientWidth;
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
    observer.observe(nav);
    observer.observe(measure);
    return () => observer.disconnect();
  }, []);

  const inline = PUBLIC_NAV.slice(0, count);
  const overflow = PUBLIC_NAV.slice(count);
  const overflowActive = overflow.some((item) => isActivePath(pathname, item));

  return (
    <nav
      ref={navRef}
      aria-label={t("mainNavigation")}
      data-measured={measured || undefined}
      className={cn(
        "relative hidden min-w-0 flex-1 items-center gap-0.5 md:flex",
        !measured && "overflow-hidden",
      )}
    >
      {/* Measuring row: same classes as the links, never seen or announced. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex w-max gap-0.5"
      >
        {PUBLIC_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <span key={item.href} className={linkClass}>
              <Icon className="size-[1.05rem]" />
              {t(item.label)}
            </span>
          );
        })}
        <span className="inline-flex size-10 shrink-0" />
      </div>

      {inline.map((item) => {
        const active = isActivePath(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              linkClass,
              "text-muted-foreground transition-[background-color,color] duration-(--dur-2) outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:bg-foreground/[0.07] aria-[current=page]:text-foreground",
            )}
          >
            <Icon
              filled={active}
              className={cn("size-[1.05rem]", active && "text-link")}
              aria-hidden
            />
            {t(item.label)}
          </Link>
        );
      })}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("more")}
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=open]:bg-foreground/[0.07] data-[state=open]:text-foreground",
              overflowActive && "bg-foreground/[0.07] text-link",
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 p-1.5">
            {overflow.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item);
              return (
                <DropdownMenuItem
                  key={item.href}
                  asChild
                  className="gap-3 rounded-xl p-2.5 whitespace-nowrap"
                >
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    <Icon filled={active} className="size-[1.1rem] text-link" aria-hidden />
                    {t(item.label)}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
