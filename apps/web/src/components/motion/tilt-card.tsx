"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A physical card under the pointer (UX-030): it tilts toward the cursor with a little inertia,
 * a light glare follows the pointer and a holographic foil shifts as the angle changes — like
 * turning a real card in the light. Touch screens get a slow idle sway instead; reduced motion
 * holds it still. Transform and two CSS variables only, so it never causes layout.
 */
export function TiltCard({
  children,
  max = 9,
  foil = true,
  className,
}: {
  children: React.ReactNode;
  /** Largest tilt, in degrees. */
  max?: number;
  /** The iridescent security foil (real licences and their illustrations). */
  foil?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduce || !fine) return;

    // Target and current values, eased each frame for a weighty, physical feel.
    const target = { rx: 0, ry: 0, gx: 50, gy: 50 };
    const now = { ...target };
    let frame = 0;
    const step = () => {
      let moving = false;
      for (const key of ["rx", "ry", "gx", "gy"] as const) {
        now[key] += (target[key] - now[key]) * 0.14;
        if (Math.abs(target[key] - now[key]) > 0.02) moving = true;
      }
      el.style.setProperty("--rx", `${now.rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${now.ry.toFixed(2)}deg`);
      el.style.setProperty("--gx", `${now.gx.toFixed(1)}%`);
      el.style.setProperty("--gy", `${now.gy.toFixed(1)}%`);
      frame = moving ? requestAnimationFrame(step) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      target.ry = (x - 0.5) * 2 * max;
      target.rx = -(y - 0.5) * 2 * max;
      target.gx = x * 100;
      target.gy = y * 100;
      el.dataset.active = "true";
      kick();
    };
    const leave = () => {
      Object.assign(target, { rx: 0, ry: 0, gx: 50, gy: 50 });
      delete el.dataset.active;
      kick();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);

  return (
    <div ref={ref} className={cn("tilt-card", className)}>
      <div className="tilt-card-inner">
        {children}
        <span aria-hidden className="tilt-glare" />
        {foil && <span aria-hidden className="tilt-foil" />}
      </div>
    </div>
  );
}
