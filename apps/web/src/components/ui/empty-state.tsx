import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Optional illustration that replaces the icon medallion. */
  art?: React.ReactNode;
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
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-dashed bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-imigongo-fade text-primary opacity-[0.05]"
      />
      {art ?? (
        <span className="relative inline-flex size-20 animate-pop items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-[1.75rem] bg-primary-soft" />
          <span
            aria-hidden
            className="absolute -inset-3 rounded-[2.25rem] border border-primary/15"
          />
          <Icon className="relative size-9 text-primary" aria-hidden />
        </span>
      )}
      <div className="relative flex max-w-md flex-col gap-1.5">
        <h2 className="text-xl">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="relative">{action}</div>}
    </div>
  );
}
