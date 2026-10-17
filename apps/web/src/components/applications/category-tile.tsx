import { CATEGORY_INFO, type Category } from "@rebp/contracts";
import { cn } from "@/lib/utils";

/**
 * A row's tile (UX-034/035): the applicant's photo when there is one, otherwise the category's
 * two letters on a soft primary gradient — the same in every list (queue, decisions, board,
 * dashboard, wallet).
 * `marker` adds the pulsing yellow dot for "needs someone". Decorative: the name is in the row.
 */
export function CategoryTile({
  category,
  marker = false,
  photo,
  size = "md",
  className,
}: {
  category: Category;
  marker?: boolean;
  /** The applicant's photo (UX-035): shown in the tile instead of the two letters. */
  photo?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_16%,var(--card)))] font-semibold tracking-wider text-link ring-1 ring-primary/10 dark:ring-white/[0.06]",
        size === "sm" && "size-8 text-[0.65rem]",
        size === "md" && "size-10 text-xs",
        size === "lg" && "size-11 rounded-2xl text-sm",
        className,
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file
        <img
          src={photo}
          alt=""
          className="absolute inset-0 size-full rounded-[inherit] object-cover"
        />
      ) : (
        CATEGORY_INFO[category].monogram
      )}
      {marker && (
        <span className="missing-mark absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sun ring-2 ring-card" />
      )}
    </span>
  );
}
