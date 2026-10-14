"use client";

import { ChevronDown, LogIn, UserPlus, UserRound } from "@/components/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuItem asChild className="items-start gap-3 rounded-xl p-2.5">
          <Link href="/sign-in">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <LogIn className="size-[1.1rem]" aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{t("signIn")}</span>
              <span className="text-xs text-muted-foreground">{t("signInHint")}</span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="items-start gap-3 rounded-xl p-2.5">
          <Link href="/sign-up">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-sun/25 text-sun-foreground">
              <UserPlus className="size-[1.1rem]" aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{t("signUp")}</span>
              <span className="text-xs text-muted-foreground">{t("signUpHint")}</span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
