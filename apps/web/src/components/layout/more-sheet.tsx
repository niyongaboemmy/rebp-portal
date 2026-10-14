"use client";

import { Grip, LogOut, Monitor, Moon, Sun } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import type { Capability } from "@rebp/contracts";
import { Avatar } from "@/components/ui/avatar";
import { Segmented } from "@/components/ui/segmented";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isActivePath, navForArea } from "@/config/navigation";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";

/**
 * "More" on phones: every destination as an icon tile, plus theme and language as segmented
 * controls (one tap each) and sign out. Opens as a bottom sheet (thumb-reachable).
 */
export function MoreSheet({
  area,
  capabilities,
  user,
}: {
  area: "portal" | "backoffice";
  capabilities: Capability[];
  user: { fullName: string; email: string };
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme = "system", setTheme } = useTheme();
  const { locale, switchTo } = useLocaleSwitch();
  const sections = navForArea(area, capabilities);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="group flex h-full w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold text-muted-foreground outline-none">
        <span className="inline-flex h-8 w-14 items-center justify-center rounded-full group-focus-visible:ring-[3px] group-focus-visible:ring-ring/40">
          <Grip className="size-[1.3rem] transition-transform group-active:scale-90" aria-hidden />
        </span>
        {t("nav.more")}
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-5 px-4">
        <SheetTitle className="sr-only">{t("nav.more")}</SheetTitle>
        <SheetDescription className="sr-only">{t("nav.mainNavigation")}</SheetDescription>
        <div className="flex items-center gap-3 pr-10">
          <Avatar name={user.fullName} className="size-11" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{user.fullName}</span>
            <span className="truncate text-sm text-muted-foreground">{user.email}</span>
          </div>
        </div>

        <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-4">
          {sections.map((section, index) => (
            <div key={`${section.label}-${index}`} className="flex flex-col gap-2">
              <p className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
                {t(`nav.${section.label}`)}
              </p>
              <ul className="grid grid-cols-3 gap-2">
                {section.items.map((item, i) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item);
                  return (
                    <li
                      key={item.href}
                      className="animate-rise"
                      style={{ animationDelay: `${i * 25}ms` }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 p-2 text-center text-xs font-semibold transition-[transform,background-color] active:scale-95",
                          active && "bg-primary-soft text-primary-soft-foreground",
                        )}
                      >
                        <Icon className={cn("size-5", active ? "" : "text-link")} aria-hidden />
                        <span className="line-clamp-2">{t(`nav.${item.label}`)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-3">
          <Segmented
            label={t("theme.toggle")}
            value={theme as "light" | "dark" | "system"}
            onValueChange={setTheme}
            options={[
              { value: "light", label: t("theme.light"), icon: <Sun /> },
              { value: "dark", label: t("theme.dark"), icon: <Moon /> },
              { value: "system", label: t("theme.system"), icon: <Monitor /> },
            ]}
          />
          <Segmented
            label={t("language.label")}
            value={locale}
            onValueChange={switchTo}
            options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code].native }))}
          />
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex tap-target w-full items-center justify-center gap-2 rounded-2xl border text-sm font-semibold text-destructive transition-colors hover:bg-danger-soft"
          >
            <LogOut className="size-4" aria-hidden /> {t("nav.signOut")}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
