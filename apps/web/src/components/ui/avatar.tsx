import { cn, initials } from "@/lib/utils";

/** Number of curated colour pairs (`--avatar-N-bg/fg` in globals.css, contrast-tested). */
const AVATAR_TONES = 8;

/**
 * Initials avatar, or the person's photo when there is one (UX-015: the profile photo). The colour comes from the name, so each person stays recognisable, but only
 * from a curated, calm set that sits well next to the brand blue (ADR-011, U4).
 */
export function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  /** Photo URL; the initials stay underneath while it loads (or if it fails). */
  src?: string | null;
  className?: string;
}) {
  const tone = ([...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES) + 1;
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-display text-sm font-bold",
        className,
      )}
      style={{ background: `var(--avatar-${tone}-bg)`, color: `var(--avatar-${tone}-fg)` }}
    >
      {initials(name)}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}
