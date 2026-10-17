"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The companion notices you (UX-031): its eyes follow the pointer and its head leans a little
 * toward it, through two inherited CSS variables (`--look-x`, `--look-y`, in SVG units) that the
 * figure's `.pb-look` and `.pb-head` read. Fine pointers only; reduced motion keeps it still.
 */
export function LookAtPointer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduce || !fine) return;
    const target = { x: 0, y: 0 };
    const now = { x: 0, y: 0 };
    let frame = 0;
    const step = () => {
      now.x += (target.x - now.x) * 0.12;
      now.y += (target.y - now.y) * 0.12;
      el.style.setProperty("--look-x", now.x.toFixed(2));
      el.style.setProperty("--look-y", now.y.toFixed(2));
      frame =
        Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.01
          ? requestAnimationFrame(step)
          : 0;
    };
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      // The face sits in the upper middle of the figure.
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height * 0.45);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 420);
      target.x = (dx / dist) * reach;
      target.y = (dy / dist) * reach;
      if (!frame) frame = requestAnimationFrame(step);
    };
    const leave = () => {
      target.x = 0;
      target.y = 0;
      if (!frame) frame = requestAnimationFrame(step);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <span ref={ref} className={cn("block", className)}>
      {children}
    </span>
  );
}
