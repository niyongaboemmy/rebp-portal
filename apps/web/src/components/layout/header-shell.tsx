"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { splitLocalePrefix } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Pages whose hero runs under the header (the header starts transparent there). */
const OVERLAY_PATHS = new Set(["/"]);

/**
 * Scroll-aware header surface. Over a full-height hero it is transparent; once the page
 * scrolls (or on any other page) it becomes a frosted bar with a small, soft shadow — the one
 * shadow the flat system allows outside overlays, because the bar now floats over content.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = splitLocalePrefix(usePathname()).path;
  const overlay = OVERLAY_PATHS.has(pathname);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !overlay;
  return (
    <header
      data-scrolled={scrolled || undefined}
      style={{ viewTransitionName: "app-header" }}
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-(--dur-3) ease-standard",
        solid
          ? "bg-card/80 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-card/70"
          : "bg-transparent",
        scrolled &&
          "shadow-[0_1px_2px_oklch(0.2_0.03_265/0.06),0_6px_16px_-10px_oklch(0.2_0.03_265/0.25)] dark:shadow-[0_1px_2px_oklch(0_0_0/0.4),0_8px_20px_-12px_oklch(0_0_0/0.7)]",
      )}
    >
      {children}
    </header>
  );
}
