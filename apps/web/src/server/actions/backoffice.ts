"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignSchema,
  conflictSchema,
  decideConfigSchema,
  decideRegisterActionSchema,
  decisionSchema,
  documentVerdictSchema,
  informationRequestSchema,
  overrideConfirmationSchema,
  proposeConfigSchema,
  registerActionSchema,
  reviewDraftSchema,
  signReviewSchema,
  waiverSchema,
  type DecisionInput,
  type ProposeConfigInput,
  type RegisterActionInput,
  type ReviewDraft,
} from "@rebp/contracts";
import { authorizeAction } from "../access/authorize";
import { runAction } from "../action";
import { decideConfig, proposeConfig } from "../config/config";
import { overrideConfirmation } from "../confirmations/confirmations";
import { setDocumentVerdict } from "../documents/documents";
import { assignTo, declareConflict } from "../backoffice/assignment";
import { recordDecision } from "../backoffice/decision";
import { requestInformation, saveReview, signReview, startReview } from "../backoffice/review";
import { runScheduledJobs } from "../jobs/lifecycle";
import { decideRegisterAction, proposeRegisterAction } from "../licensing/register-admin";
import { waiveFee } from "../payments/payments";
import { getRequestContext } from "../request-context";
import { AppError } from "../errors";
import { isDevMode } from "../env";

/**
 * Back-office entry points (WP-3.x, WP-4.x). Staff actions always require a two-step-verified
 * session (SEC-005); signing actions re-authenticate with the password (FR-L-010, FR-M-013).
 */
const id = z.uuid();
const reviewPath = (applicationId: string) => `/backoffice/review/${applicationId}`;

export async function startReviewAction(applicationId: string) {
  return runAction(async () => {
    const { user } = await authorizeAction("review.perform");
    await startReview(id.parse(applicationId), user, await getRequestContext());
    revalidatePath(reviewPath(applicationId));
    return null;
  });
}

export async function saveReviewAction(input: ReviewDraft) {
  return runAction(async () => {
    const { user } = await authorizeAction("review.perform");
    const parsed = reviewDraftSchema.parse(input);
    await saveReview(parsed, user);
    return null;
  });
}

export async function signReviewAction(input: z.input<typeof signReviewSchema>) {
  return runAction(async () => {
    const { user, session } = await authorizeAction("review.perform");
    const parsed = signReviewSchema.parse(input);
    await signReview(
      parsed.applicationId,
      parsed.password,
      user,
      session,
      await getRequestContext(),
    );
    revalidatePath(reviewPath(parsed.applicationId));
    return null;
  });
}

export async function documentVerdictAction(input: z.input<typeof documentVerdictSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("review.perform");
    const parsed = documentVerdictSchema.parse(input);
    await setDocumentVerdict(
      parsed.documentId,
      parsed.verdict,
      parsed.reason,
      user,
      await getRequestContext(),
    );
    return null;
  });
}

export async function requestInformationAction(input: z.input<typeof informationRequestSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("review.perform");
    const parsed = informationRequestSchema.parse(input);
    await requestInformation(parsed, user, await getRequestContext());
    revalidatePath(reviewPath(parsed.applicationId));
    return null;
  });
}

export async function assignAction(input: z.input<typeof assignSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("review.perform");
    const parsed = assignSchema.parse(input);
    await assignTo(parsed.applicationId, parsed.officerId, user, await getRequestContext());
    revalidatePath("/backoffice/queue");
    return null;
  });
}

export async function declareConflictAction(input: z.input<typeof conflictSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("review.perform");
    const parsed = conflictSchema.parse(input);
    await declareConflict(parsed.applicationId, parsed.reason, user, await getRequestContext());
    revalidatePath("/backoffice/queue");
    return null;
  });
}

export async function overrideConfirmationAction(
  input: z.input<typeof overrideConfirmationSchema>,
) {
  return runAction(async () => {
    const { user } = await authorizeAction("confirmation.override");
    const parsed = overrideConfirmationSchema.parse(input);
    await overrideConfirmation(parsed.id, parsed.reason, user, await getRequestContext());
    return null;
  });
}

export async function recordDecisionAction(input: DecisionInput) {
  return runAction(async () => {
    const { user, session } = await authorizeAction("decision.make");
    const parsed = decisionSchema.parse(input);
    const result = await recordDecision(parsed, user, session, await getRequestContext());
    revalidatePath("/backoffice/decisions");
    return result;
  });
}

export async function proposeRegisterChangeAction(input: RegisterActionInput) {
  return runAction(async () => {
    const { user } = await authorizeAction("register.administer");
    const parsed = registerActionSchema.parse(input);
    const result = await proposeRegisterAction(parsed, user, await getRequestContext());
    revalidatePath("/backoffice/register");
    return result;
  });
}

export async function decideRegisterActionAction(
  input: z.input<typeof decideRegisterActionSchema>,
) {
  return runAction(async () => {
    const { user } = await authorizeAction("register.revoke");
    const parsed = decideRegisterActionSchema.parse(input);
    await decideRegisterAction(
      parsed.id,
      parsed.approve,
      parsed.note,
      user,
      await getRequestContext(),
    );
    revalidatePath("/backoffice/register");
    return null;
  });
}

export async function waiveFeeAction(input: z.input<typeof waiverSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("payments.manage");
    const parsed = waiverSchema.parse(input);
    await waiveFee(parsed.applicationId, parsed.reason, user, await getRequestContext());
    revalidatePath("/backoffice/finance");
    return null;
  });
}

export async function proposeConfigAction(input: ProposeConfigInput) {
  return runAction(async () => {
    const { user } = await authorizeAction("config.edit", { stepUp: true });
    const parsed = proposeConfigSchema.parse(input);
    // Finance is the maker for fees only (App. D); system administrators for everything else.
    if (
      parsed.key === "fees"
        ? !user.roles.some((r) => r === "FINANCE_OFFICER" || r === "SYSTEM_ADMIN")
        : !user.roles.includes("SYSTEM_ADMIN")
    )
      throw new AppError("forbidden");
    await proposeConfig(parsed, user, await getRequestContext());
    revalidatePath("/backoffice/configuration");
    return null;
  });
}

export async function decideConfigAction(input: z.input<typeof decideConfigSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAction("config.approve", { stepUp: true });
    const parsed = decideConfigSchema.parse(input);
    await decideConfig(parsed.id, parsed.approve, parsed.note, user, await getRequestContext());
    revalidatePath("/backoffice/configuration");
    return null;
  });
}

/** Runs the scheduled jobs now (system administrators; dev/staging convenience for demos). */
export async function runJobsAction() {
  return runAction(async () => {
    await authorizeAction("config.edit");
    if (!isDevMode()) throw new AppError("forbidden");
    return runScheduledJobs();
  });
}
