import { cn, initials } from "@/lib/utils";

/**
 * Initials avatar, or the person's photo when there is one (UX-015: the profile photo). Initials
 * sit on the primary family's soft gradient, the same for everyone (UX-035: primary colours only).
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
  return (
    <span
      aria-hidden
      className={cn(
        // Primary family only (UX-035): a soft blue gradient and blue initials for everyone.
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_18%,var(--card)))] font-display text-sm font-bold text-link",
        className,
      )}
    >
      {initials(name)}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}
