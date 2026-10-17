import { useTranslations } from "next-intl";
import type { StatusTone } from "@rebp/contracts";
import { StatusBadge } from "@/components/ui/status-badge";

export type SlaState = "ok" | "dueSoon" | "breached";

const TONES: Record<SlaState, StatusTone> = {
  ok: "good",
  dueSoon: "warning",
  breached: "critical",
};

/** FR-BO-004: SLA state of a work item as tone + icon + words (never colour alone). */
export function SlaBadge({
  state,
  due,
  className,
}: {
  state: SlaState | null;
  due?: string;
  className?: string;
}) {
  const t = useTranslations("queue.sla");
  if (!state) return null;
  return (
    <StatusBadge
      tone={TONES[state]}
      label={due ? t("withDue", { state: t(state), due }) : t(state)}
      className={className}
    />
  );
}
