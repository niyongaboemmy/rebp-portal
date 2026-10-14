import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** UX-009: friendly empty states instead of blank screens. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="text-xl">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
