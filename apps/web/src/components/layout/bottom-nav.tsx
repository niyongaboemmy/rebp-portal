"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Capability } from "@rebp/contracts";
import { isActivePath, mobileTabs, navForArea, type NavBadges } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { MoreSheet } from "./more-sheet";

/**
 * Phone navigation (< md): a floating, one-handed bar (as in 2026 mobile shells) with three
 * primary destinations plus "More", in the thumb zone
 * (UX-001). Material 3 active indicator: a pill that grows behind the active icon. Pinned
 * during view transitions so only page content moves.
 */
export function BottomNav({
  area,
  capabilities,
  badges = {},
}: {
  area: "portal" | "backoffice";
  capabilities: Capability[];
  badges?: NavBadges;
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
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden print:hidden short:bottom-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <ul
        className="mx-auto grid h-16 max-w-md rounded-[1.75rem] bg-popover px-1.5 shadow-(--overlay) short:h-12"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((item) => {
          const active = isActivePath(pathname, item);
          const Icon = item.icon;
          const count = item.badge ? (badges[item.badge] ?? 0) : 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  count > 0 && item.badge
                    ? `${t(item.label)}, ${t(`badge.${item.badge}`, { count })}`
                    : undefined
                }
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
                      active ? "text-primary-soft-foreground" : "text-foreground/80",
                    )}
                    aria-hidden
                  />
                  {count > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-0.5 right-3 size-2 rounded-full bg-ember ring-2 ring-card forced-colors:bg-[CanvasText]"
                    />
                  )}
                </span>
                {/* Icons only on foldables (< 336 px) and short screens, where labels would truncate or crowd. */}
                <span className="max-w-full truncate px-1 max-[21rem]:sr-only short:sr-only">
                  {t(item.label)}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <MoreSheet area={area} capabilities={capabilities} badges={badges} />
        </li>
      </ul>
    </nav>
  );
}
