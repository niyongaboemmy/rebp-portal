"use client";

import { useFormatter } from "next-intl";
import { useEffect, useRef, useState } from "react";

function prefersStill(): boolean {
  if (typeof window === "undefined") return true;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData;
  return Boolean(saveData) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts from 0 to `value` once the number scrolls into view (ease-out, --dur-5). The final
 * value is server-rendered and announced; the animation only touches the visual digits.
 */
export function CountUp({
  value,
  format = "number",
  className,
}: {
  value: number;
  format?: "number" | "percent";
  className?: string;
}) {
  const formatter = useFormatter();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const fmt = (n: number) =>
    format === "percent"
      ? formatter.number(n / 100, { style: "percent", maximumFractionDigits: 0 })
      : formatter.number(Math.round(n));

  useEffect(() => {
    const node = ref.current;
    if (!node || value === 0 || prefersStill()) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 700;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setShown(value * (1 - (1 - t) ** 3));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        setShown(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>{fmt(shown)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  );
}
