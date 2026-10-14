"use client";

import { useTranslations } from "next-intl";
import type { Capability } from "@rebp/contracts";
import { navForArea } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-link";

interface AppNavProps {
  area: "portal" | "backoffice";
  capabilities: Capability[];
  variant?: "sidebar" | "rail";
  onNavigate?: () => void;
}

/** Capability-filtered navigation. Built on the client because nav items carry icon components. */
export function AppNav({ area, capabilities, variant = "sidebar", onNavigate }: AppNavProps) {
  const t = useTranslations("nav");
  const sections = navForArea(area, capabilities);
  const rail = variant === "rail";
  return (
    <nav aria-label={t("mainNavigation")} className={cn("flex flex-col", rail ? "gap-3" : "gap-6")}>
      {sections.map((section, index) => (
        <div
          key={`${section.label}-${index}`}
          className={cn(
            "flex flex-col",
            rail ? "gap-2 border-t pt-3 first:border-t-0 first:pt-0" : "gap-1",
          )}
        >
          {!rail && (
            <p className="px-3 pb-1 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
              {t(section.label)}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} variant={variant} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
