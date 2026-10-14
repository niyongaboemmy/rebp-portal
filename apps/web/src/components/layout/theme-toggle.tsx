"use client";

import { Monitor, Moon, Sun } from "@/components/icons";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const THEME_OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("toggle")}
          className={cn("relative", className)}
        >
          {/* Sun sets and the moon rises: a rotate + scale swap, transform-only. */}
          <Sun className="size-5 transition-transform duration-(--dur-4) ease-spring dark:scale-0 dark:-rotate-90" />
          <Moon
            className={cn(
              "absolute size-5 scale-0 rotate-90 transition-transform duration-(--dur-4) ease-spring dark:scale-100 dark:rotate-0",
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon /> {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One-tap theme switch for the public header: flips light ↔ dark from whatever is showing (system
 * included); the sun sets and the moon rises. "System" stays available in menus and the palette.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative rounded-full", className)}
      aria-label={dark ? t("light") : t("dark")}
      title={dark ? t("light") : t("dark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Sun className="size-5 transition-transform duration-(--dur-4) ease-spring dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-5 scale-0 rotate-90 transition-transform duration-(--dur-4) ease-spring dark:scale-100 dark:rotate-0" />
    </Button>
  );
}
