"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Pointer parallax for a layered hero illustration. Children mark layers with
 * `data-parallax="<depth>"`, styled with `parallaxStyle(depth)`; this wrapper only writes
 * --px/--py (−1…1). Transform-only, rAF-throttled, mouse/pen only, off under reduced motion.
 */
export function HeroScene({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || frame.current) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const node = ref.current;
      if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--px", (((clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
      node.style.setProperty("--py", (((clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
    });
  };
  const onPointerLeave = () => {
    ref.current?.style.setProperty("--px", "0");
    ref.current?.style.setProperty("--py", "0");
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      // An illustration: its cards keep their real shadows in the flat light theme.
      data-keep-shadow
      className={cn("relative [--px:0] [--py:0]", className)}
    >
      {children}
    </div>
  );
}
