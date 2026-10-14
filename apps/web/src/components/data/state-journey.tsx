import { cn } from "@/lib/utils";

/**
 * Compact journey pipeline (five dots joined by a track) for list rows and cards. The
 * accessible text names the current stage; the dots are decorative.
 */
export function StateJourney({
  stages,
  current,
  label,
  className,
}: {
  stages: readonly string[];
  current: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} role="img" aria-label={label}>
      <div className="flex items-center" aria-hidden>
        {stages.map((stage, index) => (
          <span key={stage} className="flex flex-1 items-center last:flex-none">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full transition-colors",
                index < current && "bg-primary",
                index === current && "size-3 bg-primary ring-4 ring-primary/20",
                index > current && "bg-border",
              )}
            />
            {index < stages.length - 1 && (
              <span
                className={cn(
                  "mx-0.5 h-0.5 flex-1 rounded-full",
                  index < current ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
