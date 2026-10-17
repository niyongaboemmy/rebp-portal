import { cn } from "@/lib/utils";

/**
 * Back-office console surfaces (UX-031/032), shared by register, finance, reports, configuration,
 * audit and access so they read like the applicant side and like each other: list groups with
 * hairline dividers inside a PANEL, soft pill filters, a pulsing Sun dot for "needs attention".
 * Plain strings, so Server and Client Components can both use them.
 */

/** A list (or table body) inside a panel: hairline rows, no shadow. */
export const LIST_GROUP =
  "divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl ring-1 ring-foreground/[0.07] dark:divide-white/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]";

/** A row in a LIST_GROUP. */
export const LIST_ROW = "px-3.5 py-2.5";

/** Hover for an interactive LIST_ROW. */
export const LIST_ROW_HOVER =
  "transition-colors duration-(--dur-2) hover:bg-primary/[0.035] dark:hover:bg-surface-3";

/** The column-title row of a table rendered as a LIST_GROUP. */
export const LIST_HEAD =
  "bg-foreground/[0.025] px-3.5 py-2 text-xs font-semibold text-muted-foreground dark:bg-white/[0.03]";

/** The quiet track that holds pill filters. */
export const PILL_TRACK =
  "flex w-fit max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-full bg-foreground/[0.04] p-1 dark:bg-surface-2/60";

/** A pill filter in a PILL_TRACK: the chosen one is a lighter surface, never a dark fill. */
export function pillClassName(selected: boolean, className?: string) {
  return cn(
    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-[background-color,color] duration-(--dur-2) outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:h-9 [&_svg]:size-4",
    selected
      ? "bg-card text-foreground dark:bg-surface-3 [&_svg]:text-link"
      : "text-muted-foreground hover:bg-card/60 hover:text-foreground dark:hover:bg-surface-3/50",
    className,
  );
}

/** A soft pill link or button outside a track (paging, "older"). */
export const SOFT_PILL =
  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.04] px-4 text-sm font-semibold text-muted-foreground transition-colors duration-(--dur-2) outline-none hover:bg-primary/[0.07] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:h-9 dark:bg-surface-2/60 dark:hover:bg-surface-3 [&_svg]:size-4";

/** "Needs attention": the applicant side's pulsing Sun dot (still under reduced motion). */
export const ATTENTION_DOT = "missing-mark size-2.5 shrink-0 rounded-full bg-sun";

/** The soft primary medallion that leads a panel or row. */
export const ICON_TILE =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground [&_svg]:size-5";

/** "Done / OK": a soft primary tick chip. */
export const OK_CHIP =
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-link [&_svg]:size-3.5";

/** A short inline "needs attention" label next to an ATTENTION_DOT. */
export const ATTENTION_CHIP =
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-sun/15 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-foreground dark:bg-sun/10";
