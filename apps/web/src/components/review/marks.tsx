import { Check, Minus, X } from "@/components/icons";
import { HOVER, SELECTED } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

/**
 * The console's small state marks (ADR-009, UX-027): a soft primary tick for what is done, an
 * animated Sun dot for what still needs the officer, a soft red cross for what failed and a quiet
 * dash for what doesn't apply. Decorative — rows always carry the state in words too.
 */
export type MarkState = "done" | "todo" | "failed" | "none";

export function Mark({ state, className }: { state: MarkState; className?: string }) {
  if (state === "todo")
    return (
      <span
        aria-hidden
        className={cn("inline-flex size-6 shrink-0 items-center justify-center", className)}
      >
        <span className="missing-mark size-2.5 rounded-full bg-sun" />
      </span>
    );
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
        state === "done" && "bg-primary-soft text-link ring-1 ring-primary/30",
        state === "failed" && "bg-danger-soft text-destructive ring-1 ring-destructive/25",
        state === "none" && "bg-foreground/[0.04] text-muted-foreground dark:bg-white/[0.06]",
        className,
      )}
    >
      {state === "done" ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : state === "failed" ? (
        <X className="size-3.5" strokeWidth={2.5} />
      ) : (
        <Minus className="size-3.5" />
      )}
    </span>
  );
}

/** A calm list group: hairline-divided rows on one rounded surface. */
export const LIST_GROUP =
  "flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl ring-1 ring-foreground/[0.07] dark:divide-white/[0.06] dark:bg-surface-2/50 dark:ring-white/[0.06]";

/** A row inside LIST_GROUP. */
export const LIST_ROW =
  "px-3.5 py-2.5 transition-colors duration-(--dur-2) hover:bg-primary/[0.035] dark:hover:bg-surface-3";

/** The category's short code on a soft primary tile (the applicant pages' tile). */
export function CategoryTile({ code, className }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_14%,var(--card)))] text-[0.65rem] font-bold text-link",
        className,
      )}
    >
      {code}
    </span>
  );
}

/** A small "needs a look" pill (overrides, open requests): Sun dot + words, never colour alone. */
export function AttentionPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full bg-sun/15 px-2.5 py-0.5 text-xs font-semibold text-foreground ring-1 ring-sun/40",
        className,
      )}
    >
      <span aria-hidden className="missing-mark size-2 rounded-full bg-sun" />
      {children}
    </span>
  );
}

/** One step of a numbered flow (decision: choose → explain → sign). */
export function StepNumber({ n, done = false }: { n: number; done?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        done
          ? "bg-primary-soft text-link ring-1 ring-primary/30"
          : "bg-foreground/[0.05] text-muted-foreground dark:bg-white/[0.07]",
      )}
    >
      {done ? <Check className="size-3.5" strokeWidth={2.5} /> : n}
    </span>
  );
}

/** A choice pill: the chosen one takes the SELECTED tint, never a solid fill. */
export function ChoicePill({
  selected,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.97] sm:h-9 [&_svg]:size-4",
        "transition-[background-color,box-shadow,color,transform] duration-(--dur-2)",
        selected
          ? cn(SELECTED, "font-semibold text-foreground")
          : cn(
              "bg-card text-muted-foreground ring-1 ring-foreground/[0.08] hover:text-foreground dark:bg-transparent dark:ring-white/[0.08]",
              HOVER,
            ),
        className,
      )}
      {...props}
    />
  );
}
