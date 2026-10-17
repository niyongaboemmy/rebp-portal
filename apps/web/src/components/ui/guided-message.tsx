import type { StatusTone } from "@rebp/contracts";
import { TONE_BORDER, TONE_ICONS, TONE_TEXT } from "@/components/data/tones";
import { cn } from "@/lib/utils";

/**
 * A problem with its way out (UX-004 §3.4): what happened, how to fix it, and one action. It sits
 * on the card without a fill: a thin accent in the tone and a tinted icon, so several on one page
 * stay calm in both themes and red still means "act here" (UX-005).
 */
export function GuidedMessage({
  tone,
  title,
  fix,
  action,
  srPrefix,
  className,
  ...props
}: {
  tone: StatusTone;
  title: React.ReactNode;
  fix?: React.ReactNode;
  action?: React.ReactNode;
  /** Read before the title by screen readers, e.g. "Not eligible yet:". */
  srPrefix?: string;
} & Omit<React.ComponentProps<"div">, "title">) {
  const Icon = TONE_ICONS[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border-l-2 py-0.5 pl-3 text-sm",
        TONE_BORDER[tone],
        className,
      )}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
        <span className="font-medium">
          {srPrefix && <span className="sr-only">{srPrefix} </span>}
          {title}
        </span>
        {fix && <span className="text-muted-foreground">{fix}</span>}
        {action && <span className="-ml-1 pt-0.5">{action}</span>}
      </div>
    </div>
  );
}
