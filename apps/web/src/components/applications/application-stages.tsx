import { Check, CreditCard, FileText, PenLine, Send } from "@/components/icons";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ApplicationStage = "form" | "sign" | "pay" | "done";

const STAGES: { key: ApplicationStage; icon: typeof FileText }[] = [
  { key: "form", icon: FileText },
  { key: "sign", icon: PenLine },
  { key: "pay", icon: CreditCard },
  { key: "done", icon: Send },
];

/**
 * The application in four plain stages (fill in → sign → pay → submitted), shown on the
 * wizard, payment and status pages so applicants always see the whole path and where they are.
 * Done stages tick, the current one glows, the line fills as they advance.
 */
export function ApplicationStages({
  current,
  hidePay = false,
  className,
}: {
  current: ApplicationStage;
  /** No fee to pay (e.g. a resubmission): the pay stage is skipped. */
  hidePay?: boolean;
  className?: string;
}) {
  const t = useTranslations("wizard.stages");
  const stages = STAGES.filter((s) => !(hidePay && s.key === "pay"));
  const at = stages.findIndex((s) => s.key === current);
  return (
    <ol aria-label={t("label")} className={cn("flex items-center gap-1.5 sm:gap-2", className)}>
      {stages.map(({ key, icon: Icon }, i) => {
        const done = i < at || (current === "done" && key === "done");
        const now = i === at && current !== "done";
        return (
          <li key={key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span
              aria-current={now ? "step" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full py-1 pr-1 pl-1 text-xs font-semibold transition-colors sm:pr-3",
                now &&
                  "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_oklch(0.45_0.2_264/0.8)]",
                done && "bg-primary-soft text-link",
                !now && !done && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full",
                  now && "bg-white/20",
                  done && "bg-primary text-white",
                  !now && !done && "bg-foreground/[0.06] dark:bg-surface-3",
                )}
              >
                {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
              </span>
              <span className={cn("truncate", !now && "max-sm:sr-only")}>{t(key)}</span>
            </span>
            {i < stages.length - 1 && (
              <span
                aria-hidden
                className="relative h-0.5 min-w-3 flex-1 overflow-hidden rounded-full bg-foreground/10"
              >
                <span
                  className={cn(
                    "absolute inset-0 origin-left bg-primary transition-transform duration-(--dur-4)",
                    i < at || current === "done" ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
