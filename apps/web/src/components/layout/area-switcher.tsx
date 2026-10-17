"use client";

import { useTranslations } from "next-intl";
import { ChevronsUpDown } from "@/components/icons/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRow,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSurfaceCollapsed } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AREA_HOME, type AppArea } from "@/config/navigation";

const AREAS: AppArea[] = ["portal", "backoffice"];

/**
 * Applicant portal ↔ back office (N5). A context switch, not a destination, so it sits under the
 * logo rather than in the nav. Only rendered for staff (`canSwitchArea`).
 */
export function AreaSwitcher({ area }: { area: AppArea }) {
  const t = useTranslations();
  const collapsed = useSurfaceCollapsed();
  const Current = AREA_HOME[area].icon;
  const label = t(`shell.area.${area}`);

  return (
    <DropdownMenu>
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={`${t("shell.areaSwitch")}: ${label}`}
            className="flex h-11 w-full items-center gap-2.5 rounded-[1rem] bg-card px-2.5 text-left text-sm font-semibold transition-colors outline-none hover:bg-card/70 focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-white/[0.05] sb-collapsed:size-11 sb-collapsed:justify-center sb-collapsed:px-0"
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <Current className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate sb-collapsed:hidden">{label}</span>
            <ChevronsUpDown
              className="size-4 shrink-0 text-muted-foreground sb-collapsed:hidden"
              aria-hidden
            />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right" sideOffset={10}>
            {label}
          </TooltipContent>
        )}
      </Tooltip>
      <DropdownMenuContent
        align="start"
        side={collapsed ? "right" : "bottom"}
        className="w-(--radix-dropdown-menu-trigger-width) min-w-64"
      >
        <DropdownMenuLabel>{t("shell.areaSwitch")}</DropdownMenuLabel>
        {AREAS.map((key) => {
          const Icon = AREA_HOME[key].icon;
          return (
            <DropdownMenuRow
              key={key}
              href={AREA_HOME[key].href}
              icon={<Icon />}
              title={t(`shell.area.${key}`)}
              description={t(`shell.areaHint.${key}`)}
              current={key === area}
            />
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
