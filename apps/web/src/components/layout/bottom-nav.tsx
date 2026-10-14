"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Capability } from "@rebp/contracts";
import { isActivePath, mobileTabs, navForArea } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { MoreSheet } from "./more-sheet";

/**
 * Phone navigation (< md): three primary destinations plus "More", in the thumb zone
 * (UX-001). Material 3 active indicator: a pill that grows behind the active icon. Pinned
 * during view transitions so only page content moves.
 */
export function BottomNav({
  area,
  capabilities,
  user,
}: {
  area: "portal" | "backoffice";
  capabilities: Capability[];
  user: { fullName: string; email: string };
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const sections = navForArea(area, capabilities);
  const tabs = mobileTabs(sections);

  return (
    <nav
      aria-label={t("tabBar")}
      data-bottom-nav
      style={{ viewTransitionName: "app-bottom-nav" }}
      className="fixed inset-x-0 bottom-0 z-40 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 md:hidden"
    >
      <ul
        className="mx-auto grid h-[4.5rem] max-w-md px-2"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((item) => {
          const active = isActivePath(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold text-muted-foreground outline-none aria-[current=page]:text-foreground"
              >
                <span
                  className={cn(
                    "relative inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors group-focus-visible:ring-[3px] group-focus-visible:ring-ring/40",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 rounded-full bg-primary-soft transition-transform duration-(--dur-3) ease-spring",
                      active ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                  <Icon
                    className={cn(
                      "relative size-[1.3rem] transition-transform duration-(--dur-2) group-active:scale-90",
                      active && "text-primary-soft-foreground",
                    )}
                    aria-hidden
                  />
                </span>
                <span className="max-w-full truncate px-1">{t(item.label)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <MoreSheet area={area} capabilities={capabilities} user={user} />
        </li>
      </ul>
    </nav>
  );
}
