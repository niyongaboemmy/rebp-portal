import type { LucideIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Optional illustration that replaces the icon medallion. */
  art?: React.ReactNode;
  /** 1 when the empty state is the whole page (it then carries the page's <h1>). */
  headingLevel?: 1 | 2;
  className?: string;
}

/**
 * UX-009: friendly empty states instead of blank screens — one picture, one line, one action.
 * The icon sits on a soft halo with the Imigongo motif behind it (decorative).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  art,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div
      className={cn(
        "relative flex animate-rise flex-col items-center gap-5 overflow-hidden rounded-[2rem] bg-card/80 px-6 py-12 text-center backdrop-blur-xl dark:bg-white/[0.03]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-imigongo-fade text-link opacity-[0.05]"
      />
      {art ?? (
        <span className="relative inline-flex size-20 animate-pop items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-[1.75rem] bg-primary-soft" />
          <span aria-hidden className="absolute -inset-3 rounded-[2.25rem] bg-primary-soft/40" />
          <Icon className="relative size-9 text-link" aria-hidden />
        </span>
      )}
      <div className="relative flex max-w-md flex-col gap-1.5">
        <Heading className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">{title}</Heading>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="relative">{action}</div>}
    </div>
  );
}
