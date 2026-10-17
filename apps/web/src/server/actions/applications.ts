"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  changeCategorySchema,
  createApplicationSchema,
  declarationSchema,
  GATEWAY_OUTCOMES,
  saveSectionSchema,
  signSchema,
  startPaymentSchema,
  STEP_KEYS,
  type CreateApplicationInput,
} from "@rebp/contracts";
import { authorizeAction } from "../access/authorize";
import { enforceRateLimit, runAction } from "../action";
import {
  changeCategory,
  createApplication,
  rememberStep,
  saveSection,
  withdrawApplication,
} from "../applications/applications";
import { readiness } from "../applications/submission";
import { requestSignature, signAndSubmit } from "../applications/submission";
import { ownApplication } from "../applications/applications";
import { remindAddressee } from "../confirmations/confirmations";
import { removeDocument } from "../documents/documents";
import {
  reconcilePayments,
  sandboxEnabled,
  simulateCheckout,
  startPayment,
} from "../payments/payments";
import { AppError } from "../errors";
import { getRequestContext } from "../request-context";

/**
 * Applicant entry points (WP-1.1…2.7). Thin: validate with the shared contract, rate-limit,
 * authorise (capability; MFA where the role requires it), call the domain, map errors.
 */
const applicant = () => authorizeAction("application.edit", { requireMfa: "auto" });
const id = z.uuid();

export async function createApplicationAction(input: CreateApplicationInput) {
  return runAction(async () => {
    const { user } = await applicant();
    const parsed = createApplicationSchema.parse(input);
    const app = await createApplication(user, parsed, await getRequestContext());
    revalidatePath("/applications");
    return { id: app.id };
  });
}

/** Autosave (FR-WIZ-004): returns the section's issues and live eligibility (FR-WIZ-007). */
export async function saveSectionAction(
  applicationId: string,
  input: z.input<typeof saveSectionSchema>,
  step?: string,
) {
  return runAction(async () => {
    const { user } = await applicant();
    const parsed = saveSectionSchema.parse(input);
    const result = await saveSection(
      id.parse(applicationId),
      parsed,
      user,
      await getRequestContext(),
      step ? z.enum(STEP_KEYS).parse(step) : undefined,
    );
    return {
      issues: result.issues,
      eligibility: {
        outcome: result.eligibility.outcome,
        rules: result.eligibility.rules,
        experience: result.eligibility.experience ?? null,
      },
    };
  });
}

export async function rememberStepAction(applicationId: string, step: string) {
  return runAction(async () => {
    const { user } = await applicant();
    await rememberStep(id.parse(applicationId), z.enum(STEP_KEYS).parse(step), user);
    return null;
  });
}

export async function changeCategoryAction(input: z.input<typeof changeCategorySchema>) {
  return runAction(async () => {
    const { user } = await applicant();
    const parsed = changeCategorySchema.parse(input);
    await changeCategory(parsed.applicationId, parsed.category, user, await getRequestContext());
    revalidatePath(`/applications/${parsed.applicationId}`);
    return null;
  });
}

export async function withdrawApplicationAction(applicationId: string) {
  return runAction(async () => {
    const { user } = await applicant();
    await withdrawApplication(id.parse(applicationId), user, await getRequestContext());
    revalidatePath("/applications");
    return null;
  });
}

export async function removeDocumentAction(documentId: string) {
  return runAction(async () => {
    const { user } = await applicant();
    await removeDocument(id.parse(documentId), user, await getRequestContext());
    return null;
  });
}

/** Readiness for the review step (FR-WIZ-008/013). */
export async function readinessAction(applicationId: string) {
  return runAction(async () => {
    const { user } = await applicant();
    const app = await ownApplication(id.parse(applicationId), user);
    const ready = await readiness(app);
    return {
      canSubmit: ready.canSubmit,
      missingDocuments: ready.missingDocuments,
      sections: ready.sections,
      outcome: ready.eligibility.outcome,
    };
  });
}

/** FR-J-004: step 1 of signing — send a one-time code. */
export async function requestSignatureAction(input: z.input<typeof declarationSchema>) {
  return runAction(async () => {
    await enforceRateLimit("signature");
    const { user } = await applicant();
    const parsed = declarationSchema.parse(input);
    return requestSignature(parsed.applicationId, parsed.method, user);
  });
}

/** FR-J-004/005, FR-PAY-014: step 2 — sign with the code and submit. */
export async function signAndSubmitAction(
  input: z.input<typeof signSchema> & { method: "EMAIL" | "SMS"; capacity?: string },
) {
  return runAction(async () => {
    await enforceRateLimit("otpVerify", "signature");
    const { user } = await applicant();
    const parsed = signSchema.parse(input);
    const result = await signAndSubmit(
      parsed.applicationId,
      {
        code: parsed.code,
        method: z.enum(["EMAIL", "SMS"]).parse(input.method),
        capacity: input.capacity,
      },
      user,
      await getRequestContext(),
    );
    revalidatePath(`/applications/${parsed.applicationId}`);
    return result;
  });
}

export async function startPaymentAction(input: z.input<typeof startPaymentSchema>) {
  return runAction(async () => {
    await enforceRateLimit("payment");
    const { user } = await authorizeAction("payments.pay", { requireMfa: "auto" });
    const parsed = startPaymentSchema.parse(input);
    return startPayment(
      parsed.applicationId,
      parsed.method,
      parsed.msisdn,
      user,
      await getRequestContext(),
    );
  });
}

/** Sandbox checkout (mock gateway only). */
export async function simulateCheckoutAction(
  reference: string,
  outcome: (typeof GATEWAY_OUTCOMES)[number],
) {
  return runAction(async () => {
    await enforceRateLimit("payment", "checkout");
    const { user } = await authorizeAction("payments.pay", { requireMfa: "auto" });
    const status = await simulateCheckout(
      z.string().max(40).parse(reference),
      z.enum(GATEWAY_OUTCOMES).parse(outcome),
      user,
    );
    return { status };
  });
}

/** The payment page polls this while a delayed confirmation is pending (FR-PAY-005). */
export async function refreshPaymentAction() {
  return runAction(async () => {
    await authorizeAction("payments.pay", { requireMfa: "auto" });
    if (!sandboxEnabled()) throw new AppError("forbidden");
    await reconcilePayments();
    return null;
  });
}

export async function remindAddresseeAction(confirmationId: string) {
  return runAction(async () => {
    const { user } = await applicant();
    await remindAddressee(id.parse(confirmationId), user);
    return null;
  });
}
