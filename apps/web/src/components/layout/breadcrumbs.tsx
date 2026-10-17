"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState } from "react";
import type { Capability } from "@rebp/contracts";
import { ChevronRight } from "@/components/icons";
import {
  ACCOUNT_LINKS,
  activeItem,
  AREA_HOME,
  navForArea,
  type AppArea,
  type NavLabelKey,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

/** The page-supplied end of the trail: the record being viewed, and its parent when the route
 *  is not in the navigation (e.g. a review under the work queue). */
export interface BreadcrumbTailValue {
  label: string;
  parent?: { href: Route; label: NavLabelKey };
}

/** The tail plus the path it was set on, so a stale tail never shows on the next page. */
type ScopedTail = BreadcrumbTailValue & { pathname: string };

const TailContext = createContext<{
  tail: ScopedTail | null;
  setTail: (tail: ScopedTail | null) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [tail, setTail] = useState<ScopedTail | null>(null);
  return <TailContext.Provider value={{ tail, setTail }}>{children}</TailContext.Provider>;
}

/** Renders nothing; sets the trail's last crumb for the current page (T1). */
export function BreadcrumbTail({ label, parent }: BreadcrumbTailValue) {
  const context = useContext(TailContext);
  const setTail = context?.setTail;
  const pathname = usePathname();
  const parentHref = parent?.href;
  const parentLabel = parent?.label;
  useEffect(() => {
    if (!setTail) return;
    setTail({
      pathname,
      label,
      parent: parentHref && parentLabel ? { href: parentHref, label: parentLabel } : undefined,
    });
    return () => setTail(null);
  }, [setTail, pathname, label, parentHref, parentLabel]);
  return null;
}

interface Crumb {
  href?: Route;
  label: string;
  /** The area itself; folded away below xl, where the sidebar's area switcher names it. */
  root?: boolean;
}

/**
 * Where am I (T1): area · section · record. Derived from the nav config, so it follows the same
 * capability filtering as the sidebar; the last crumb is the current page.
 */
export function Breadcrumbs({
  area,
  capabilities,
  className,
}: {
  area: AppArea;
  capabilities: Capability[];
  className?: string;
}) {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const pathname = usePathname();
  const scoped = useContext(TailContext)?.tail ?? null;
  const tail = scoped?.pathname === pathname ? scoped : null;
  const home = AREA_HOME[area];
  const item = activeItem(
    [...navForArea(area, capabilities), { label: null, items: ACCOUNT_LINKS }],
    pathname,
  );

  const crumbs: Crumb[] = [];
  // The root uses the area's name, as in the area switcher ("Applicant portal", "Back office").
  if (!item || item.href !== home.href)
    crumbs.push({ href: home.href, label: tShell(`area.${area}`), root: true });
  if (item) crumbs.push({ href: item.href, label: t(item.label) });
  else if (tail?.parent) crumbs.push({ href: tail.parent.href, label: t(tail.parent.label) });
  if (tail) crumbs.push({ label: tail.label });

  return (
    <nav aria-label={t("breadcrumb")} className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li
              key={`${crumb.label}-${index}`}
              className={cn(
                "flex min-w-0 items-center gap-1",
                // Below xl the area root folds away (the sidebar's area switcher already names it).
                crumb.root && crumbs.length > 1 && "max-xl:hidden",
              )}
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground/70",
                    index === 1 && crumbs[0]?.root && "max-xl:hidden",
                  )}
                />
              )}
              {last || !crumb.href ? (
                <span
                  aria-current={last ? "page" : undefined}
                  title={crumb.label}
                  className="truncate font-semibold text-foreground"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  title={crumb.label}
                  className="inline-block min-h-6 max-w-48 truncate rounded-md py-0.5 leading-5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
