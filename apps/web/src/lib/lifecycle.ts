import type { ApplicationStatus } from "@rebp/contracts";

/**
 * An application's whole journey as the applicant lives it (UX-028): their part — fill in, sign,
 * pay — then the regulator's — confirmations, review, decision. One track for the list, the
 * status page and their graphics, so "where am I" reads the same everywhere.
 */
export const LIFECYCLE = ["fill", "sign", "pay", "confirm", "review", "decision"] as const;
export type LifecycleStep = (typeof LIFECYCLE)[number];

/**
 * active: in progress at `index`; attention: the applicant must act there; done: the whole
 * journey is complete; refused: it ended without a licence; stopped: withdrawn or expired.
 */
export type LifecycleState = "active" | "attention" | "done" | "refused" | "stopped";

export function lifecycleOf(
  status: ApplicationStatus,
  lastStep?: string | null,
): { index: number; state: LifecycleState } {
  switch (status) {
    case "DRAFT":
      return { index: lastStep === "review" ? 1 : 0, state: "active" };
    case "EXPIRED_DRAFT":
    case "WITHDRAWN":
      return { index: 0, state: "stopped" };
    case "PENDING_PAYMENT":
      return { index: 2, state: "active" };
    case "PENDING_CONFIRMATIONS":
      return { index: 3, state: "active" };
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "FURTHER_ASSESSMENT":
      return { index: 4, state: "active" };
    case "ACTION_REQUIRED":
      return { index: 4, state: "attention" };
    case "PENDING_DECISION":
    case "DEFERRED":
      return { index: 5, state: "active" };
    case "APPROVED":
    case "APPROVED_WITH_CONDITIONS":
    case "LICENSE_ISSUED":
      return { index: 5, state: "done" };
    case "REJECTED":
      return { index: 5, state: "refused" };
  }
}

/** The animated companion's mood for a status (profile-buddy.tsx). */
export function moodForStatus(
  status: ApplicationStatus,
): "write" | "pay" | "waiting" | "celebrate" | "worried" | "wave" {
  const { state, index } = lifecycleOf(status);
  if (state === "done") return "celebrate";
  if (state === "refused" || state === "attention") return "worried";
  if (state === "stopped") return "wave";
  if (index <= 1) return "write";
  if (index === 2) return "pay";
  return "waiting";
}
