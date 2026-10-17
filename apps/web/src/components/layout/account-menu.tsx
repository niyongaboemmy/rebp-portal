"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import { DEFAULT_SHELL_PREFS, type Capability, type ShellPrefs } from "@rebp/contracts";
import {
  ArrowLeftRight,
  Globe2,
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from "@/components/icons";
import { ChevronsUpDown } from "@/components/icons/nav";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Segmented } from "@/components/ui/segmented";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useOptionalSidebar, useSurfaceCollapsed } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { accountLinksFor, AREA_HOME, type AppArea, type NavItem } from "@/config/navigation";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { clearRecentPages } from "@/lib/recent-pages";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";

export interface AccountUser {
  fullName: string;
  email: string;
  /** The person's main role, already translated (e.g. "Reviewing officer"). */
  roleLabel?: string;
  /** The profile photo, when the person has uploaded one (UX-015). */
  photoUrl?: string | null;
  /** A person (not an organisation): has a profile. */
  person?: boolean;
  /** An individual applicant: also has a CV. */
  applicant?: boolean;
}

interface AccountMenuProps {
  user: AccountUser;
  /** The area being viewed; null on public pages. */
  area: AppArea | null;
  /** Staff: offer the other area. */
  canSwitchArea?: boolean;
  /** Effective capabilities: decide which account links show (My access is staff-only). */
  capabilities?: readonly Capability[];
}

const THEMES = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

/**
 * The account destinations in one ordered list (U1): both the desktop menu and the phone sheet
 * render it, so they cannot drift apart.
 */
export function accountLinks(
  area: AppArea | null,
  canSwitchArea: boolean,
  capabilities: readonly Capability[],
  kind?: { person: boolean; applicant: boolean },
): NavItem[] {
  const links: NavItem[] = [];
  if (area === null) links.push(AREA_HOME.portal);
  else if (canSwitchArea) links.push(AREA_HOME[area === "portal" ? "backoffice" : "portal"]);
  return [...links, ...accountLinksFor(capabilities, kind)];
}

function Identity({ user, className }: { user: AccountUser; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar name={user.fullName} src={user.photoUrl} className="size-10" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{user.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        {user.roleLabel && (
          <span className="mt-0.5 truncate text-xs font-medium text-link">{user.roleLabel}</span>
        )}
      </div>
    </div>
  );
}

function linkIcon(item: NavItem, area: AppArea | null): LucideIcon {
  // The area switch reads as a switch, not as another page.
  return area !== null && item === AREA_HOME[area === "portal" ? "backoffice" : "portal"]
    ? ArrowLeftRight
    : item.icon;
}

function useLinkTitle() {
  const t = useTranslations();
  return (item: NavItem, area: AppArea | null) =>
    area !== null && (item.label === "portal" || item.label === "backoffice")
      ? t("shell.switchTo", {
          area: t(`shell.area.${item.label === "portal" ? "portal" : "backoffice"}`),
        })
      : t(`nav.${item.label}`);
}

/** Menu body shared by the sidebar card and the public header trigger. */
function AccountMenuItems({
  user,
  area,
  canSwitchArea = false,
  capabilities = [],
}: AccountMenuProps) {
  const t = useTranslations();
  const title = useLinkTitle();
  const { theme = "system", setTheme } = useTheme();
  const { locale, switchTo } = useLocaleSwitch();
  const shell = useOptionalSidebar();
  return (
    <>
      <Identity
        user={user}
        className="mb-1 rounded-xl bg-primary-soft/60 p-2.5 dark:bg-primary/[0.12]"
      />
      {accountLinks(area, canSwitchArea, capabilities, {
        person: user.person ?? true,
        applicant: user.applicant ?? true,
      }).map((item) => {
        const Icon = linkIcon(item, area);
        return (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <Icon aria-hidden /> {title(item, area)}
            </Link>
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          icon={theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
          value={t(`theme.${theme as "light" | "dark" | "system"}`)}
        >
          {t("theme.toggle")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
            {THEMES.map(({ value, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon /> {t(`theme.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger icon={<Globe2 />} value={LOCALE_LABELS[locale].native}>
          {t("language.label")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={locale} onValueChange={switchTo}>
            {LOCALES.map((code) => (
              <DropdownMenuRadioItem key={code} value={code} lang={code}>
                {LOCALE_LABELS[code].native}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {shell && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={<SlidersHorizontal />}>
            {t("shell.layout")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuLabel>{t("shell.density")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={shell.prefs.density}
              onValueChange={(density) =>
                shell.setPrefs({ density: density as ShellPrefs["density"] })
              }
            >
              <DropdownMenuRadioItem value="comfortable">
                {t("shell.densityComfortable")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="compact">
                {t("shell.densityCompact")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("shell.width")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={shell.prefs.width}
              onValueChange={(width) => shell.setPrefs({ width: width as ShellPrefs["width"] })}
            >
              <DropdownMenuRadioItem value="default">
                {t("shell.widthDefault")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="full">{t("shell.widthFull")}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => shell.setPrefs(DEFAULT_SHELL_PREFS)}>
              <RotateCcw aria-hidden /> {t("shell.resetLayout")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      <DropdownMenuSeparator />
      {/* One flat row style throughout, so every icon sits in the same column. */}
      <DropdownMenuItem
        onSelect={() => {
          clearRecentPages();
          void signOutAction();
        }}
        className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive dark:data-[highlighted]:bg-destructive/15 [&_svg]:text-destructive!"
      >
        <LogOut aria-hidden /> {t("nav.signOut")}
      </DropdownMenuItem>
    </>
  );
}

/**
 * Identity card in the sidebar footer (U2): avatar, name, role and a chevron, opening the account
 * menu upwards (or to the right on the rail). Its accessible name contains the visible name
 * (WCAG 2.5.3).
 */
export function SidebarAccountMenu(props: AccountMenuProps) {
  const t = useTranslations("nav");
  const collapsed = useSurfaceCollapsed();
  const { user } = props;
  return (
    <DropdownMenu>
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={t("accountFor", { name: user.fullName })}
            className="flex w-full items-center gap-2.5 rounded-[1rem] p-1.5 text-left transition-colors outline-none hover:bg-foreground/[0.05] focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=open]:bg-foreground/[0.05] dark:hover:bg-white/[0.05] sb-collapsed:w-auto sb-collapsed:justify-center"
          >
            <Avatar name={user.fullName} src={user.photoUrl} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight sb-collapsed:hidden">
              <span className="truncate text-sm font-semibold">{user.fullName}</span>
              {user.roleLabel && (
                <span className="truncate text-xs text-muted-foreground">{user.roleLabel}</span>
              )}
            </span>
            <ChevronsUpDown
              className="size-4 shrink-0 text-muted-foreground sb-collapsed:hidden"
              aria-hidden
            />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {collapsed && (
          <TooltipContent side="right" sideOffset={10}>
            {user.fullName}
          </TooltipContent>
        )}
      </Tooltip>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "end" : "start"}
        className="w-80"
      >
        <AccountMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Header trigger (public pages): avatar and name, same menu. */
export function HeaderAccountMenu(props: AccountMenuProps) {
  const t = useTranslations("nav");
  const { user } = props;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex tap-target items-center gap-2 rounded-full p-1 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:pr-3"
        aria-label={t("accountFor", { name: user.fullName })}
      >
        <Avatar name={user.fullName} src={user.photoUrl} />
        <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">
          {user.fullName}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <AccountMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Phones (< md): the top-bar avatar opens the same account content as a bottom sheet, with
 * one-tap segmented controls for theme and language.
 */
export function AccountSheet(props: AccountMenuProps) {
  const t = useTranslations();
  const title = useLinkTitle();
  const [open, setOpen] = useState(false);
  const { theme = "system", setTheme } = useTheme();
  const { locale, switchTo } = useLocaleSwitch();
  const { user, area, canSwitchArea = false, capabilities = [] } = props;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("nav.accountFor", { name: user.fullName })}
        className="inline-flex tap-target items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 md:hidden"
      >
        <Avatar name={user.fullName} src={user.photoUrl} />
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-5 px-4">
        <SheetTitle className="sr-only">{t("nav.account")}</SheetTitle>
        <SheetDescription className="sr-only">{user.fullName}</SheetDescription>
        <Identity user={user} className="pr-10" />
        <ul className="flex flex-col gap-1">
          {accountLinks(area, canSwitchArea, capabilities, {
            person: user.person ?? true,
            applicant: user.applicant ?? true,
          }).map((item) => {
            const Icon = linkIcon(item, area);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex tap-target items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Icon className="size-5 text-link" aria-hidden />
                  {title(item, area)}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-3">
          <Segmented
            label={t("theme.toggle")}
            value={theme as "light" | "dark" | "system"}
            onValueChange={setTheme}
            options={THEMES.map(({ value, icon: Icon }) => ({
              value,
              label: t(`theme.${value}`),
              icon: <Icon />,
            }))}
          />
          <Segmented
            label={t("language.label")}
            value={locale}
            onValueChange={switchTo}
            options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code].native }))}
          />
        </div>
        <form action={signOutAction} onSubmit={clearRecentPages}>
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
