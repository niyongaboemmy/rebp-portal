"use client";

import { ArrowLeftRight, Grip } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Capability } from "@rebp/contracts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AREA_HOME,
  canSwitchArea,
  isActivePath,
  mobileTabs,
  navForArea,
  type AppArea,
  type NavBadges,
  type NavItem,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * "More" on phones: every destination as an icon tile, in sidebar order, plus the area
 * switch for staff. Account, theme and language live in the account sheet (top-bar avatar), so
 * identity has one home per viewport (ADR-011). Opens as a bottom sheet (thumb-reachable).
 */
export function MoreSheet({
  area,
  capabilities,
  badges = {},
}: {
  area: AppArea;
  capabilities: Capability[];
  badges?: NavBadges;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sections = navForArea(area, capabilities);
  // Something waiting behind "More" (not on a tab) earns the trigger a dot.
  const tabHrefs = new Set(mobileTabs(sections).map((item) => item.href));
  const waiting = sections
    .flatMap((section) => section.items)
    .filter((item) => !tabHrefs.has(item.href) && item.badge)
    .reduce((sum, item) => sum + (badges[item.badge!] ?? 0), 0);
  const other = AREA_HOME[area === "portal" ? "backoffice" : "portal"];

  const tile = (item: NavItem, index: number, label: string, Icon = item.icon) => {
    const active = isActivePath(pathname, item);
    const count = item.badge ? (badges[item.badge] ?? 0) : 0;
    return (
      <li key={item.href} className="animate-rise" style={{ animationDelay: `${index * 25}ms` }}>
        <Link
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={active ? "page" : undefined}
          aria-label={
            count > 0 && item.badge
              ? `${label}, ${t(`nav.badge.${item.badge}`, { count })}`
              : undefined
          }
          className={cn(
            "relative flex h-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 p-2 text-center text-xs font-semibold transition-[transform,background-color] active:scale-95",
            active && "bg-primary-soft text-primary-soft-foreground",
          )}
        >
          <Icon className={cn("size-5", active ? "" : "text-link")} aria-hidden />
          <span className="line-clamp-2">{label}</span>
          {count > 0 && (
            <span
              aria-hidden
              className="absolute top-2 right-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] leading-5 num text-primary-foreground"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={
          waiting > 0
            ? `${t("nav.more")}, ${t("shell.moreWaiting", { count: waiting })}`
            : undefined
        }
        className="group flex h-full w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold text-muted-foreground outline-none"
      >
        <span className="relative inline-flex h-8 w-14 items-center justify-center rounded-full group-focus-visible:ring-[3px] group-focus-visible:ring-ring/40">
          <Grip className="size-[1.3rem] transition-transform group-active:scale-90" aria-hidden />
          {waiting > 0 && (
            <span
              aria-hidden
              className="absolute top-0.5 right-3 size-2 rounded-full bg-ember ring-2 ring-card forced-colors:bg-[CanvasText]"
            />
          )}
        </span>
        <span className="max-[21rem]:sr-only short:sr-only">{t("nav.more")}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-5 px-4" data-more-sheet>
        <SheetTitle className="text-base font-semibold">{t("nav.more")}</SheetTitle>
        <SheetDescription className="sr-only">{t("nav.mainNavigation")}</SheetDescription>
        <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-4">
          {/* One grid in sidebar order: on a phone, group headings cost more than they explain. */}
          <ul className="grid grid-cols-3 gap-2">
            {sections
              .flatMap((section) => section.items)
              .map((item, i) => tile(item, i, t(`nav.${item.label}`)))}
          </ul>
          {canSwitchArea(capabilities) && (
            <ul className="grid grid-cols-3 gap-2 border-t pt-4">
              {tile(
                other,
                0,
                t("shell.switchTo", {
                  area: t(`shell.area.${other.label === "portal" ? "portal" : "backoffice"}`),
                }),
                ArrowLeftRight,
              )}
            </ul>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
