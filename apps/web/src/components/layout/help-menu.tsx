"use client";

import { useTranslations } from "next-intl";
import { CircleHelp, FileStack, ListChecks, Lock, Timeline } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRow,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Help, in the same place on every signed-in page (WCAG 2.2 3.2.6 Consistent Help): guidance
 * pages and the keyboard shortcuts.
 */
export function HelpMenu() {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("shell.help")}>
          <CircleHelp className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("shell.help")}</DropdownMenuLabel>
        <DropdownMenuRow href="/#how" icon={<Timeline />} title={t("landing.stepsTitle")} />
        <DropdownMenuRow href="/eligibility" icon={<ListChecks />} title={t("nav.eligibility")} />
        <DropdownMenuRow href="/categories" icon={<FileStack />} title={t("nav.categories")} />
        <DropdownMenuRow href="/privacy" icon={<Lock />} title={t("footer.privacy")} />
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("shell.shortcuts")}</DropdownMenuLabel>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-2.5 pt-1 pb-2 text-sm">
          <dt className="text-muted-foreground">{t("shell.shortcutSearch")}</dt>
          <dd>
            <kbd className="rounded-md bg-muted px-1.5 font-mono text-xs">⌘K</kbd>
          </dd>
          <dt className="text-muted-foreground">{t("shell.shortcutSidebar")}</dt>
          <dd>
            <kbd className="rounded-md bg-muted px-1.5 font-mono text-xs">⌘B</kbd>
          </dd>
        </dl>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
