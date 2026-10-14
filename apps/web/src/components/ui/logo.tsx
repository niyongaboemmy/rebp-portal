import Link from "next/link";
import { cn } from "@/lib/utils";

/** Neutral pilot mark (P8 default until brand assets arrive): a house with a check. */
export function Logo({
  className,
  showText = true,
  text = "REBP Portal",
}: {
  className?: string;
  showText?: boolean;
  text?: string;
}) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5 rounded-lg", className)}>
      <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="10" className="fill-primary" />
        <path
          d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"
          className="fill-primary-foreground/95"
        />
        <path
          d="m12.5 18.5 2.5 2.5 4.5-5"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
        />
        <circle cx="25" cy="8" r="3" className="fill-accent" />
      </svg>
      {showText && <span className="font-display text-lg font-bold tracking-tight">{text}</span>}
    </Link>
  );
}
