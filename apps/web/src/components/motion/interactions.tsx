"use client";

import { useEffect } from "react";

/** Elements that answer a press with a ripple from the touch point. */
const RIPPLE = '[data-slot="button"]:not(:disabled), [data-ripple]';

/**
 * App-wide physical feedback with one delegated listener each (no per-component cost):
 * - tap ripple: a soft circle grows from the press point on buttons and `[data-ripple]` hosts;
 * - cursor spotlight: writes --spot-x/--spot-y into the hovered `.spotlight` card (rAF).
 * Both skip reduced motion; the spotlight ignores touch.
 */
export function Interactions() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onPointerDown = (event: PointerEvent) => {
      if (reduced.matches || event.button !== 0) return;
      const host = (event.target as Element | null)?.closest?.<HTMLElement>(RIPPLE);
      if (!host || host.closest("[data-no-ripple]")) return;
      const rect = host.getBoundingClientRect();
      const size = Math.hypot(rect.width, rect.height) * 2;
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.setAttribute("aria-hidden", "true");
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.style.overflow = "hidden";
      host.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    };

    let frame = 0;
    let last: PointerEvent | null = null;
    const applySpotlight = () => {
      frame = 0;
      const card = (last?.target as Element | null)?.closest?.<HTMLElement>(".spotlight");
      if (!card || !last) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${last.clientX - rect.left}px`);
      card.style.setProperty("--spot-y", `${last.clientY - rect.top}px`);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reduced.matches) return;
      last = event;
      if (!frame) frame = requestAnimationFrame(applySpotlight);
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
