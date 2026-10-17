"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignSchema,
  bulkAssignSchema,
  conflictSchema,
  correctDecisionSchema,
  decideConfigSchema,
  decideRegisterActionSchema,
  decisionSchema,
  documentVerdictSchema,
  informationRequestSchema,
  overrideConfirmationSchema,
  proposeConfigSchema,
  registerActionSchema,
  reissueCertificateSchema,
  reviewDraftSchema,
  signReviewSchema,
  waiverSchema,
  type CorrectDecisionInput,
  type DecisionInput,
  type ProposeConfigInput,
  type RegisterActionInput,
  type ReviewDraft,
} from "@rebp/contracts";
import { authorizeAction } from "../access/authorize";
import { userCan } from "../access/permissions";
import { reauthenticate } from "../auth/step-up";
import { runAction } from "../action";
import { decideConfig, proposeConfig } from "../config/config";
import { overrideConfirmation } from "../confirmations/confirmations";
import { setDocumentVerdict } from "../documents/documents";
import { assignTo, bulkAssign, declareConflict } from "../backoffice/assignment";
import { correctDecision, recordDecision } from "../backoffice/decision";
import { requestInformation, saveReview, signReview, startReview } from "../backoffice/review";
import { runScheduledJobs } from "../jobs/lifecycle";
import { reissueCertificate } from "../licensing/licensing";
import { decideRegisterAction, proposeRegisterAction } from "../licensing/register-admin";
import { waiveFee } from "../payments/payments";
import { getRequestContext } from "../request-context";
import { AppError } from "../errors";
import { isDevMode } from "../env";

/**
 * Back-office entry points (WP-3.x, WP-4.x). Staff actions always require a two-step-verified
 * session (SEC-005); signing a review or a decision is an explicit, confirmed approval in that
 * session (FR-L-010, FR-M-013). Certificate reissue still re-authenticates with the password.
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
    const { user } = await authorizeAction("review.perform");
    const parsed = signReviewSchema.parse(input);
    await signReview(parsed.applicationId, user, await getRequestContext());
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

/** FR-BO-002/005: officers (review.perform) and team leads (review.assign) may assign. */
async function authorizeAssignment() {
  const current = await authorizeAction("backoffice.access");
  if (
    !(await userCan(current.user, "review.assign")) &&
    !(await userCan(current.user, "review.perform"))
  )
    throw new AppError("forbidden");
  return current;
}

export async function assignAction(input: z.input<typeof assignSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAssignment();
    const parsed = assignSchema.parse(input);
    await assignTo(parsed.applicationId, parsed.officerId, user, await getRequestContext());
    revalidatePath("/backoffice/queue");
    return null;
  });
}

export async function bulkAssignAction(input: z.input<typeof bulkAssignSchema>) {
  return runAction(async () => {
    const { user } = await authorizeAssignment();
    const parsed = bulkAssignSchema.parse(input);
    const result = await bulkAssign(
      parsed.applicationIds,
      parsed.officerId,
      user,
      await getRequestContext(),
    );
    revalidatePath("/backoffice/queue");
    return result;
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
    const { user } = await authorizeAction("decision.make");
    const parsed = decisionSchema.parse(input);
    const result = await recordDecision(parsed, user, await getRequestContext());
    revalidatePath("/backoffice/decisions");
    return result;
  });
}

/** FR-M-017: a correcting decision, confirmed like the original. */
export async function correctDecisionAction(input: CorrectDecisionInput) {
  return runAction(async () => {
    const { user } = await authorizeAction("decision.make");
    const parsed = correctDecisionSchema.parse(input);
    const result = await correctDecision(parsed, user, await getRequestContext());
    revalidatePath("/backoffice/decisions");
    return result;
  });
}

/** FR-N-012: certificate reissue; the password confirms it (step-up, SEC-005). */
export async function reissueCertificateAction(input: z.input<typeof reissueCertificateSchema>) {
  return runAction(async () => {
    const { user, session } = await authorizeAction("register.administer");
    const parsed = reissueCertificateSchema.parse(input);
    const ctx = await getRequestContext();
    await reauthenticate(user, session, parsed.password, ctx);
    const result = await reissueCertificate(parsed.licenceId, user.id, parsed.reason, ctx);
    revalidatePath("/backoffice/register");
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
    // Maker scope is checked by capability in proposeConfig (FR-ADM-003).
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
