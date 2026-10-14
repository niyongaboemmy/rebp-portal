import { cn } from "@/lib/utils";

/**
 * Smart-card chip in Sun gold: a rounded plate with contact lines. Decorative detail that makes
 * a licence read as a physical card (landing illustrations).
 */
export function CardChip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 30" aria-hidden className={cn("w-[13%] min-w-7", className)}>
      <defs>
        <linearGradient id="card-chip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.93 0.11 92)" />
          <stop offset="0.5" stopColor="oklch(0.82 0.15 80)" />
          <stop offset="1" stopColor="oklch(0.7 0.14 70)" />
        </linearGradient>
      </defs>
      <rect width="40" height="30" rx="6" fill="url(#card-chip-gold)" />
      <path
        d="M0 10h12m16 0h12M0 20h12m16 0h12M12 0v30m16-30v30M12 10h16v10H12z"
        fill="none"
        stroke="oklch(0.45 0.08 70 / 0.45)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** Contactless mark: three arcs, in the card's ink. */
export function Contactless({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("size-[7%] min-w-4", className)}
    >
      <path d="M8 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M16 3.5a12 12 0 0 1 0 17" />
    </svg>
  );
}
