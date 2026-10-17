import "server-only";
import { cache } from "react";
import type { Capability } from "@rebp/contracts";
import type { AppArea, NavBadges } from "@/config/navigation";
import { consoleCounts } from "@/server/backoffice/admin-queries";
import { db } from "@/server/db";
import { pendingConfirmationCount } from "@/server/confirmations/confirmations";

/**
 * What is waiting per destination, for the shell's nav badges (FR-PORTAL-001, FR-RPT-001).
 * Counts only what the user's capabilities cover; computed once per request.
 */
export const navBadges = cache(
  async (
    userId: string,
    area: AppArea,
    capabilities: readonly Capability[],
  ): Promise<NavBadges> => {
    if (area === "backoffice") {
      const counts = await consoleCounts(userId, capabilities);
      const badges: NavBadges = {};
      for (const [key, value] of Object.entries(counts))
        if (typeof value === "number") badges[key as keyof typeof counts] = value;
      return badges;
    }
    const [applications, confirmations] = await Promise.all([
      // The applicant's own move: answer an information request, or pay (as on the dashboard).
      db.application.count({
        where: { applicantId: userId, status: { in: ["ACTION_REQUIRED", "PENDING_PAYMENT"] } },
      }),
      capabilities.includes("confirmation.decide") ? pendingConfirmationCount(userId) : 0,
    ]);
    return { applications, confirmations };
  },
);
