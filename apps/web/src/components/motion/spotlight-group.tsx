"use client";

import { useEffect, useRef } from "react";

/**
 * Light that follows the pointer (UX-030): every `[data-spot]` element inside gets a soft primary
 * glow where the cursor is, as if lit from above — one listener for the whole group. The wrapper
 * has no box of its own (`display: contents`), so it never changes the page's layout. Fine
 * pointers only; reduced motion leaves surfaces unlit.
 */
export function SpotlightGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduce || !fine) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const paint = () => {
      frame = 0;
      if (!last) return;
      for (const el of root.querySelectorAll<HTMLElement>("[data-spot]")) {
        const box = el.getBoundingClientRect();
        el.style.setProperty("--sx", `${last.clientX - box.left}px`);
        el.style.setProperty("--sy", `${last.clientY - box.top}px`);
      }
    };
    const move = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    root.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", move);
    };
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
