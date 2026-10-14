import { SketchUnderline } from "@/components/motion/sketch-underline";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small label above the title (e.g. the area or a count). */
  eyebrow?: React.ReactNode;
  className?: string;
}

/**
 * Portal and back-office page header in the landing page's language: optional eyebrow, a bold
 * title with the Sun underline, one line, and actions on the right. Rises in on entry.
 */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex animate-rise flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {eyebrow && (
          <span className="text-xs font-bold tracking-widest text-link uppercase">{eyebrow}</span>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[clamp(1.6rem,1.2rem+1.4vw,2.3rem)] leading-tight font-bold tracking-[-0.025em]">
            {title}
          </h1>
          <SketchUnderline className="h-2 w-24 sm:h-2.5 sm:w-28" />
        </div>
        {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
