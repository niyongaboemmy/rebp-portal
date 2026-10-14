"use client";

import { Slot } from "radix-ui";
import { useEffect, useRef } from "react";

let observer: IntersectionObserver | null = null;

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = "shown";
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
  );
  return observer;
}

/**
 * Fade-and-rise on scroll for public pages (one shared IntersectionObserver). Content is
 * visible without JS: it is only hidden after hydration, and only if it's still off-screen.
 */
export function Reveal({
  children,
  stagger = 0,
  className,
}: {
  children: React.ReactElement;
  /** Index for a 40 ms stagger within a group. */
  stagger?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight) return; // already on screen: never flash it away
    node.dataset.reveal = "hidden";
    shared().observe(node);
    return () => shared().unobserve(node);
  }, []);
  return (
    <Slot.Root
      ref={ref}
      className={className}
      style={{ "--stagger": stagger } as React.CSSProperties}
      data-reveal=""
    >
      {children}
    </Slot.Root>
  );
}
