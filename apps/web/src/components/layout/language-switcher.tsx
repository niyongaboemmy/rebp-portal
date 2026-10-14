"use client";

import { ChevronDown } from "@/components/icons";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/ui/flag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** UX-003: language switcher on every page, one flat flag per language with its native and English names;
 * rows tint on hover. The choice is remembered. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const { locale, switchTo, pending } = useLocaleSwitch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("label")}
          disabled={pending}
          className={cn(
            "group/lang w-auto gap-1.5 px-2.5 hover:bg-primary-soft hover:text-primary-soft-foreground data-[state=open]:bg-primary-soft data-[state=open]:text-primary-soft-foreground max-xs:w-11 max-xs:px-0 sm:w-auto",
            className,
          )}
        >
          <Flag locale={locale} />
          <span className="text-xs font-bold uppercase max-xs:hidden">{locale}</span>
          <ChevronDown className="size-3.5 opacity-60 transition-transform duration-(--dur-2) group-data-[state=open]/lang:rotate-180 max-xs:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={switchTo}>
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code} className="min-h-13">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 transition-transform duration-(--dur-3) ease-spring group-data-[highlighted]:scale-110 group-data-[highlighted]:-rotate-3 dark:bg-white/[0.06]">
                <Flag locale={code} className="h-3.5! w-5!" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="flex items-center gap-1.5">
                  {LOCALE_LABELS[code].native}
                  {!LOCALE_LABELS[code].approved && (
                    <span className="rounded-full bg-sun/20 px-1.5 py-px text-[0.6rem] font-bold tracking-wide text-sun-foreground uppercase dark:bg-sun/15 dark:text-sun">
                      {t("draft")}
                    </span>
                  )}
                </span>
                {LOCALE_LABELS[code].label !== LOCALE_LABELS[code].native && (
                  <span lang="en" className="text-xs font-normal text-muted-foreground">
                    {LOCALE_LABELS[code].label}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
