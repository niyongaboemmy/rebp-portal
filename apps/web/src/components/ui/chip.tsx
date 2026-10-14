import { cn } from "@/lib/utils";

/**
 * Filter chip (FR-BO-001, FR-REG-002). Renders as a link or button via `asChild`-free props:
 * pass `selected` for toggle state; it is exposed as aria-pressed (buttons) or aria-current (links).
 */
export function chipClassName(selected: boolean, className?: string) {
  return cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-(--dur-2) outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.96] [&_svg]:size-4",
    selected
      ? "border-transparent bg-foreground text-background"
      : "bg-card text-muted-foreground hover:border-input hover:text-foreground",
    className,
  );
}

export function Chip({
  selected = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={chipClassName(selected, className)}
      {...props}
    />
  );
}

/** Horizontally scrollable chip row; edges fade so overflow is discoverable on phones. */
export function ChipRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
        className,
      )}
      {...props}
    />
  );
}
