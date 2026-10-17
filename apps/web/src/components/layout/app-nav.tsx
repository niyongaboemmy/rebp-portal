"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Capability } from "@rebp/contracts";
import { SidebarGroup, SidebarMenuButton } from "@/components/ui/sidebar";
import { isActivePath, navForArea, type NavBadges } from "@/config/navigation";

interface AppNavProps {
  area: "portal" | "backoffice";
  capabilities: Capability[];
  /** What is waiting per destination (plain numbers from the server). */
  badges?: NavBadges;
}

/**
 * Capability-filtered navigation, rendered once for both the expanded sidebar and the icon rail
 * (ADR-011). Built on the client because nav items carry icon components.
 */
export function AppNav({ area, capabilities, badges = {} }: AppNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const sections = navForArea(area, capabilities);
  return (
    <nav aria-label={t("mainNavigation")} className="flex w-full flex-col gap-5 sb-collapsed:gap-3">
      {sections.map((section, index) => (
        <SidebarGroup
          key={`${section.label ?? "home"}-${index}`}
          label={section.label ? t(section.label) : undefined}
        >
          {section.items.map((item) => {
            const count = item.badge ? (badges[item.badge] ?? 0) : 0;
            return (
              <SidebarMenuButton
                key={item.href}
                href={item.href}
                label={t(item.label)}
                icon={item.icon}
                active={isActivePath(pathname, item)}
                badge={
                  item.badge && count > 0
                    ? { count, label: t(`badge.${item.badge}`, { count }) }
                    : undefined
                }
              />
            );
          })}
        </SidebarGroup>
      ))}
    </nav>
  );
}
