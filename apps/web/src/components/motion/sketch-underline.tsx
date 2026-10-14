import { cn } from "@/lib/utils";

/**
 * Hand-drawn underline that draws itself in (stroke-dashoffset), in the brand Sun colour. A
 * "sketch" accent for display headings; decorative only.
 */
export function SketchUnderline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 18"
      preserveAspectRatio="none"
      className={cn("h-3 w-56 text-sun sm:h-4 sm:w-72", className)}
    >
      <path
        d="M3 13c48-7 98-10 150-9 58 1 106 4 164-2M24 16c62-5 132-6 214-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={100}
        className="animate-[draw_900ms_var(--ease-enter)_400ms_both]"
      />
    </svg>
  );
}
