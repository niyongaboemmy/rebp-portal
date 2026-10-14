"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { Capability } from "@rebp/contracts";
import { cn } from "@/lib/utils";

// The dialog (commands, filtering, preferences) loads on first use, keeping it out of every
// page's initial JavaScript (NFR-PERF-005).
const CommandPaletteDialog = dynamic(() => import("./command-palette-dialog"), { ssr: false });

/**
 * Command palette trigger: the header search button plus the ⌘K / Ctrl+K shortcut. Jumps to any
 * page the user can reach, searches the register, checks a licence, switches theme or language.
 */
export function CommandPalette({
  area,
  capabilities = [],
  className,
}: {
  area: "public" | "portal" | "backoffice";
  capabilities?: Capability[];
  className?: string;
}) {
  const t = useTranslations("palette");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const show = useCallback((value: boolean) => {
    if (value) setLoaded(true);
    setOpen(value);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLoaded(true);
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => show(true)}
        aria-label={t("open")}
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          "inline-flex tap-target items-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 md:h-10 md:min-w-56 md:justify-between md:border md:bg-card md:px-3",
          className,
        )}
      >
        <span className="inline-flex items-center gap-2 max-md:mx-auto">
          <Search className="size-5 md:size-4" aria-hidden />
          <span className="hidden md:inline">{t("placeholder")}</span>
        </span>
        <kbd className="hidden rounded-md border bg-muted px-1.5 font-mono text-[0.7rem] md:inline">
          ⌘K
        </kbd>
      </button>
      {loaded && (
        <CommandPaletteDialog area={area} capabilities={capabilities} open={open} setOpen={show} />
      )}
    </>
  );
}
