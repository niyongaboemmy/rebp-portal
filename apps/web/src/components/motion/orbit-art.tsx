import { cn } from "@/lib/utils";
import { BadgeCheck, FileText, ShieldCheck, UserPlus } from "@/components/icons";

/** Four milestones riding the orbit: account, application, protection, licence. */
const NODES = [
  { icon: UserPlus, angle: 0 },
  { icon: FileText, angle: 90 },
  { icon: ShieldCheck, angle: 180 },
  { icon: BadgeCheck, angle: 270 },
] as const;

/**
 * Calm orbit art (auth showcase, empty states, page heroes): slow light pools, three hairline rings turning at
 * different speeds, four milestone icons orbiting (kept upright) and the logo mark breathing in
 * the centre. Everything moves slowly and fades back while any field has focus
 * (`group-has-[:focus]`) so it never competes with typing. Decorative; still under reduced
 * motion.
 */
export function OrbitArt({
  center,
  className,
  fadeOnFocus = false,
}: {
  /** Replaces the logo mark in the middle (e.g. a page icon). */
  center?: React.ReactNode;
  className?: string;
  /** Fade back while a field in <main> has focus (forms beside it). */
  fadeOnFocus?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none relative mx-auto aspect-square w-full transition-opacity duration-700",
        fadeOnFocus && "group-has-[main_:focus]/auth:opacity-60",
        className,
      )}
    >
      {/* Light pools. */}
      <span className="absolute inset-[10%] animate-aurora rounded-full bg-primary/20 blur-3xl dark:bg-primary/30" />
      <span className="absolute inset-[30%] translate-x-1/4 animate-aurora rounded-full bg-sky/20 blur-3xl [animation-delay:-7s] dark:bg-sky/15" />
      <span className="absolute inset-[38%] -translate-x-1/4 translate-y-1/4 animate-aurora rounded-full bg-sun/15 blur-3xl [animation-delay:-12s]" />

      {/* Rings: dashed and solid hairlines turning at different speeds. */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full">
        <g className="origin-center animate-[spin_90s_linear_infinite] [transform-box:fill-box]">
          <circle
            cx="200"
            cy="200"
            r="190"
            fill="none"
            strokeWidth="1"
            strokeDasharray="2 10"
            className="stroke-foreground/20 dark:stroke-white/20"
          />
        </g>
        <circle
          cx="200"
          cy="200"
          r="140"
          fill="none"
          strokeWidth="1"
          className="stroke-foreground/10 dark:stroke-white/10"
        />
        <g className="origin-center animate-[spin_24s_linear_infinite_reverse] [transform-box:fill-box]">
          <circle
            cx="200"
            cy="200"
            r="90"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="60 505"
            className="stroke-sun"
          />
          <circle
            cx="200"
            cy="200"
            r="90"
            fill="none"
            strokeWidth="1"
            className="stroke-foreground/10 dark:stroke-white/10"
          />
        </g>
      </svg>

      {/* Milestones orbiting the middle ring; each counter-rotates to stay upright. */}
      <div className="absolute inset-[15%] animate-[spin_60s_linear_infinite]">
        {NODES.map(({ icon: Icon, angle }) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <span
              key={angle}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${50 + 50 * Math.sin(rad)}%`, top: `${50 - 50 * Math.cos(rad)}%` }}
            >
              <span className="flex size-11 animate-[spin_60s_linear_infinite_reverse] items-center justify-center rounded-2xl bg-white/70 text-link shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_8px_20px_-10px_oklch(0.3_0.12_264/0.45)] backdrop-blur-md dark:bg-white/[0.07] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]">
                <Icon className="size-5" />
              </span>
            </span>
          );
        })}
      </div>

      {/* Centre: the logo mark, breathing. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="absolute size-24 animate-pulse-ring rounded-[2rem] text-primary [animation-duration:4s]" />
        {center ?? (
          <svg
            viewBox="0 0 32 32"
            className="size-20 animate-[float_6s_ease-in-out_infinite] drop-shadow-[0_14px_24px_oklch(0.45_0.2_264/0.45)]"
          >
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
            <circle cx="25" cy="8" r="3" className="fill-sun" />
          </svg>
        )}
      </div>
    </div>
  );
}
