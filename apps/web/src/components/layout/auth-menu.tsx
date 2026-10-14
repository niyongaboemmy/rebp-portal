"use client";

import { ChevronDown, LogIn, UserPlus, UserRound } from "@/components/icons";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRow,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * One entry point for signed-out visitors: a single primary button that opens "Sign in" and
 * "Create account" (fewer competing buttons in the header; the menu explains each choice).
 */
export function AuthMenu() {
  const t = useTranslations("nav");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="rounded-full pr-3 pl-3.5 data-[state=open]:[&>svg:last-child]:rotate-180">
          <UserRound className="size-[1.1rem]" aria-hidden />
          <span className="hidden xs:inline">{t("signIn")}</span>
          <span className="sr-only xs:hidden">{t("account")}</span>
          <ChevronDown className="size-3.5 opacity-80" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[19rem]">
        <DropdownMenuRow
          href="/sign-in"
          icon={<LogIn />}
          title={t("signIn")}
          description={t("signInHint")}
        />
        <DropdownMenuSeparator />
        <DropdownMenuRow
          href="/sign-up"
          icon={<UserPlus />}
          title={t("signUp")}
          description={t("signUpHint")}
          tone="featured"
          badge
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
