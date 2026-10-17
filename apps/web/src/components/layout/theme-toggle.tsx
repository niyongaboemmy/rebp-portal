"use client";

import { Moon, Sun } from "@/components/icons";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One-tap theme switch for the public header: flips light ↔ dark from whatever is showing (system
 * included); the sun sets and the moon rises. "System" stays available in menus and the palette.
 */
const noopSubscribe = () => () => {};

export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  // The theme is only known in the browser: render a neutral label on the server and first
  // client pass (no hydration mismatch), then the specific one.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const dark = resolvedTheme === "dark";
  const label = mounted ? (dark ? t("light") : t("dark")) : t("toggle");
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative rounded-full", className)}
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Sun className="size-5 transition-transform duration-(--dur-4) ease-spring dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-5 scale-0 rotate-90 transition-transform duration-(--dur-4) ease-spring dark:scale-100 dark:rotate-0" />
    </Button>
  );
}
