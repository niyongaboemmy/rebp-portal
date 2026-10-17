import type { LucideIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { PANEL } from "./surface";

/**
 * One panel for every console (UX-033): the glass surface, then a header of fixed proportions —
 * a 36 px icon tile, an 18 px title, an optional one-line description, and meta or an action on
 * the right — so panels line up across the back office whatever they hold.
 */
export function Panel({
  id,
  title,
  icon: Icon,
  description,
  meta,
  action,
  tone,
  className,
  bodyClassName,
  children,
}: {
  /** Heading id; the section is labelled by it. */
  id: string;
  title: React.ReactNode;
  icon?: LucideIcon;
  description?: React.ReactNode;
  /** Small text on the right (a count, a date range). */
  meta?: React.ReactNode;
  /** A control on the right (a link or button). */
  action?: React.ReactNode;
  /** "attention": a sun-tinted edge for items that need someone. */
  tone?: "attention" | "danger";
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 animate-rise flex-col gap-4",
        PANEL,
        tone === "attention" && "ring-sun/45 dark:ring-sun/35",
        tone === "danger" && "ring-destructive/35 dark:ring-destructive/40",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        {Icon && (
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
              tone === "danger"
                ? "bg-danger-soft text-destructive"
                : "bg-primary-soft text-link dark:bg-primary/15",
            )}
          >
            <Icon className="size-[1.1rem]" aria-hidden />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
          <h2 id={id} className="text-lg leading-tight font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {meta && (
          <span className="shrink-0 pt-1.5 text-xs font-medium num text-muted-foreground">
            {meta}
          </span>
        )}
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn("flex min-w-0 flex-col gap-3", bodyClassName)}>{children}</div>
    </section>
  );
}
