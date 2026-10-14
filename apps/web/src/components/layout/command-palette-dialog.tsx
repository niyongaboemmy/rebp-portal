"use client";

import {
  ArrowRight,
  CornerDownLeft,
  Languages,
  Monitor,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  type LucideIcon,
} from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Capability } from "@rebp/contracts";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { navForArea, PUBLIC_NAV, type NavItem } from "@/config/navigation";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";

interface Command {
  id: string;
  group: "go" | "search" | "prefs";
  label: string;
  icon: LucideIcon;
  run: () => void;
}

function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Command palette dialog, loaded on first open (see ./command-palette.tsx). Command palette (⌘K / Ctrl+K, or the search button): jump to any page the user can reach,
 * search the public register or check a licence, switch theme or language. A combobox +
 * listbox (WAI-ARIA APG) on the shared Dialog, which is a bottom sheet on phones.
 */
export default function CommandPaletteDialog({
  area,
  capabilities = [],
  open,
  setOpen,
}: {
  area: "public" | "portal" | "backoffice";
  capabilities?: Capability[];
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { setTheme } = useTheme();
  const { switchTo } = useLocaleSwitch();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href as never);
    };
    const nav: NavItem[] =
      area === "public"
        ? PUBLIC_NAV
        : navForArea(area, capabilities).flatMap((section) => section.items);
    const q = query.trim();
    const list: Command[] = nav.map((item) => ({
      id: `go-${item.href}`,
      group: "go",
      label: t(`nav.${item.label}`),
      icon: item.icon,
      run: go(item.href),
    }));
    list.push(
      ...(
        [
          ["light", Sun],
          ["dark", Moon],
          ["system", Monitor],
        ] as const
      ).map(([value, icon]) => ({
        id: `theme-${value}`,
        group: "prefs" as const,
        label: `${t("theme.toggle")}: ${t(`theme.${value}`)}`,
        icon,
        run: () => {
          setTheme(value);
          setOpen(false);
        },
      })),
      ...LOCALES.map((code) => ({
        id: `lang-${code}`,
        group: "prefs" as const,
        label: `${t("language.label")}: ${LOCALE_LABELS[code].native}`,
        icon: Languages,
        run: () => {
          switchTo(code);
          setOpen(false);
        },
      })),
    );
    const search: Command[] = [];
    if (q) {
      search.push(
        {
          id: "search-register",
          group: "search",
          label: t("palette.searchRegister", { query: q }),
          icon: Search,
          run: go(`/register?q=${encodeURIComponent(q)}`),
        },
        {
          id: "check-licence",
          group: "search",
          label: t("palette.checkLicence", { query: q }),
          icon: ShieldCheck,
          run: go(`/check/${encodeURIComponent(q.toUpperCase())}`),
        },
      );
    }
    if (!q) return list;
    const needle = normalise(q);
    const matches = list.filter((c) => normalise(c.label).includes(needle));
    // Exact page matches first (Enter jumps there); register search and licence check as fallbacks.
    return [
      ...matches.filter((c) => c.group === "go"),
      ...search,
      ...matches.filter((c) => c.group === "prefs"),
    ];
  }, [area, capabilities, query, router, setOpen, setTheme, switchTo, t]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(commands.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commands[active]?.run();
    }
  };

  const groups = (["go", "search", "prefs"] as const).filter((g) =>
    commands.some((c) => c.group === g),
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          setActive(0);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:top-[15%] sm:max-w-xl sm:translate-y-0">
          <DialogTitle className="sr-only">{t("palette.open")}</DialogTitle>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                commands[active] ? `${listId}-${commands[active].id}` : undefined
              }
              aria-label={t("palette.placeholder")}
              placeholder={t("palette.placeholder")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-14 min-w-0 flex-1 bg-transparent pr-10 text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            aria-label={t("palette.results")}
            className="max-h-[min(60dvh,26rem)] overflow-y-auto p-2"
          >
            {commands.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("palette.empty")}
              </li>
            )}
            {groups.map((group) => (
              <li key={group} role="presentation" className="flex flex-col">
                <span className="px-3 pt-2 pb-1 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
                  {t(`palette.groups.${group}`)}
                </span>
                <ul role="group" className="flex flex-col">
                  {commands.map((command, index) => {
                    if (command.group !== group) return null;
                    const Icon = command.icon;
                    return (
                      <li
                        key={command.id}
                        id={`${listId}-${command.id}`}
                        role="option"
                        aria-selected={index === active}
                        data-index={index}
                        onMouseMove={() => setActive(index)}
                        onClick={command.run}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium aria-selected:bg-primary-soft aria-selected:text-primary-soft-foreground"
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{command.label}</span>
                        {index === active ? (
                          <CornerDownLeft className="size-4 shrink-0 opacity-60" aria-hidden />
                        ) : (
                          <ArrowRight className="size-4 shrink-0 opacity-0" aria-hidden />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
