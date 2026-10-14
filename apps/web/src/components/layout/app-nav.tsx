"use client";

import { useTranslations } from "next-intl";
import type { Capability } from "@rebp/contracts";
import { navForArea } from "@/config/navigation";
import { NavLink } from "./nav-link";

interface AppNavProps {
  area: "portal" | "backoffice";
  capabilities: Capability[];
  onNavigate?: () => void;
}

/** Capability-filtered sidebar navigation. Built on the client because nav items carry icon components. */
export function AppNav({ area, capabilities, onNavigate }: AppNavProps) {
  const t = useTranslations("nav");
  const sections = navForArea(area, capabilities);
  return (
    <nav aria-label={t("mainNavigation")} className="flex flex-col gap-6">
      {sections.map((section, index) => (
        <div key={`${section.label}-${index}`} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
            {t(section.label)}
          </p>
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
