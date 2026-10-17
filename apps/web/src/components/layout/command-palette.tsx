"use client";

import { Search } from "@/components/icons";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
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
  recentKey,
  className,
  compact = false,
}: {
  area: "public" | "portal" | "backoffice";
  capabilities?: Capability[];
  /** Signed-in areas: scope for the palette's recent pages (the user id). */
  recentKey?: string;
  className?: string;
  /** Icon-only trigger (public header); the shortcut is shown in its tooltip. */
  compact?: boolean;
}) {
  const t = useTranslations("palette");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Each opening is a fresh session (empty query, first item active), whatever closed the last one.
  const [session, setSession] = useState(0);

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const show = useCallback((value: boolean) => {
    if (value) {
      setLoaded(true);
      setSession((n) => n + 1);
    }
    setOpen(value);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        show(!openRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => show(true)}
          aria-label={t("open")}
          title={`${t("open")} (⌘K)`}
          aria-keyshortcuts="Control+K Meta+K"
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-(--dur-2) outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95",
            className,
          )}
        >
          <Search className="size-5" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => show(true)}
          aria-label={t("open")}
          aria-keyshortcuts="Control+K Meta+K"
          className={cn(
            "inline-flex tap-target items-center gap-2 rounded-xl text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 md:h-10 md:min-w-56 md:justify-between md:bg-surface-2 md:px-3 md:hover:bg-surface-3",
            className,
          )}
        >
          <span className="inline-flex items-center gap-2 max-md:mx-auto">
            <Search className="size-5 md:size-4" aria-hidden />
            <span className="hidden md:inline">{t("placeholder")}</span>
          </span>
          <kbd className="hidden rounded-md bg-card px-1.5 font-mono text-[0.7rem] md:inline">
            ⌘K
          </kbd>
        </button>
      )}
      {loaded && (
        <CommandPaletteDialog
          key={session}
          area={area}
          capabilities={capabilities}
          recentKey={recentKey}
          open={open}
          setOpen={show}
        />
      )}
    </>
  );
}
