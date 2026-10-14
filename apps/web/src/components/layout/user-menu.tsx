"use client";

import { LayoutDashboard, LogOut, ShieldCheck } from "@/components/icons";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRow,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/actions/auth";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const t = useTranslations("nav");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex tap-target items-center gap-2 rounded-full p-1 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:pr-3"
        aria-label={t("account")}
      >
        <Avatar name={name} />
        <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {/* Identity card: who is signed in, on a soft brand wash. */}
        <div className="mb-1 flex items-center gap-3 rounded-xl bg-primary-soft/60 p-3 dark:bg-primary/[0.12]">
          <Avatar name={name} />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </div>
        <DropdownMenuRow href="/dashboard" icon={<LayoutDashboard />} title={t("dashboard")} />
        <DropdownMenuRow href="/settings/security" icon={<ShieldCheck />} title={t("security")} />
        <DropdownMenuSeparator />
        <DropdownMenuRow
          icon={<LogOut />}
          title={t("signOut")}
          tone="danger"
          trailing={null}
          onSelect={() => void signOutAction()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
