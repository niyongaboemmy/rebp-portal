"use client";

import { useEffect, useState } from "react";

/**
 * The app shell's sticky top bar (ADR-011). Flat and opaque; a hairline appears once content
 * scrolls under it (T4). A passive scroll listener rather than a scroll-driven animation: those
 * report as permanently "running", which reads as unsettled UI to tooling that waits for
 * animations to finish.
 */
export function TopBar({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      data-scrolled={scrolled || undefined}
      style={{ viewTransitionName: "app-header" }}
      className="app-top-bar sticky top-0 z-30 flex h-(--header-h) shrink-0 items-center gap-2 border-b border-transparent bg-background px-3 transition-[border-color] duration-(--dur-2) data-scrolled:border-border sm:px-4 print:hidden"
    >
      {children}
    </header>
  );
}
