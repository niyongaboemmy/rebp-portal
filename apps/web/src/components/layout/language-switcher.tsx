"use client";

import { Languages } from "@/components/icons";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/** UX-003: language switcher on every page; the choice is remembered. */
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
          className={cn("w-auto gap-1.5 px-2.5", className)}
        >
          <Languages className="size-5" />
          <span className="text-xs font-bold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={switchTo}>
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              {LOCALE_LABELS[code].native}
              {!LOCALE_LABELS[code].approved && <Badge variant="outline">{t("draft")}</Badge>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
