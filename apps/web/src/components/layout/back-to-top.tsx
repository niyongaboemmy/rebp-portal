"use client";

import { ArrowRight } from "@/components/icons";

/** Footer "Back to top": smooth unless the user prefers reduced motion; focus returns to main. */
export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
      className="group inline-flex h-9 items-center gap-2 rounded-full pr-1 pl-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      {label}
      <span className="inline-flex size-7 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-link transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowRight className="size-3.5 -rotate-90 transition-transform duration-300 group-hover:-translate-y-0.5" />
      </span>
    </button>
  );
}
