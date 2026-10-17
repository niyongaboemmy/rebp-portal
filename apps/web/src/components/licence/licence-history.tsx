import { useLocale, useTranslations } from "next-intl";
import { LICENSE_STATUS_TONES, type LicenseStatus } from "@rebp/contracts";
import { TONE_ICONS, TONE_SOFT_BG, TONE_TEXT } from "@/components/data/tones";
import { formatDay } from "@/lib/format";
import { eventAction } from "@/lib/licence-display";
import { cn } from "@/lib/utils";

export interface LicenceHistoryEvent {
  id: bigint | string;
  action: string;
  toStatus: LicenseStatus;
  at: Date;
  startsOn: Date | null;
  endsOn: Date | null;
}

/**
 * Public status history of a licence (FR-REG-004, FR-PORTAL-003): what happened and when, in the
 * tone of the resulting status (icon + label, never colour alone). Never shows reasons.
 */
export function LicenceHistory({ events }: { events: LicenceHistoryEvent[] }) {
  const t = useTranslations("verification.events");
  const locale = useLocale();
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const tone = LICENSE_STATUS_TONES[event.toStatus];
        const Icon = TONE_ICONS[tone];
        return (
          <li key={String(event.id)} className="relative flex gap-3 pb-4 last:pb-0">
            {index < events.length - 1 && (
              <span
                aria-hidden
                className="absolute top-9 bottom-1 left-[1.0625rem] w-px bg-border"
              />
            )}
            <span
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                TONE_SOFT_BG[tone],
                TONE_TEXT[tone],
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col pt-1">
              <span className="text-sm font-medium">{t(eventAction(event.action))}</span>
              <time dateTime={event.at.toISOString()} className="text-xs text-muted-foreground">
                {formatDay(event.startsOn ?? event.at, locale)}
                {event.endsOn ? ` – ${formatDay(event.endsOn, locale)}` : ""}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
