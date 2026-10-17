"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  forgotPasswordSchema,
  MFA_METHODS,
  type MfaMethod,
  verifyContactSchema,
  type SignInInput,
  type SignUpInput,
  type TwoStepInput,
} from "@rebp/contracts";
import { z } from "zod";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { enforceRateLimit, runAction } from "../action";
import { isFullyVerified, sendContactCode, signUp, verifyContact } from "../auth/account";
import { clearCookie, COOKIE, readCookie, setCookie } from "../auth/cookies";
import { getCurrentSession } from "../auth/current";
import { safeNextPath, landingFor } from "../auth/guards";
import {
  describeChallenge,
  resendChallengeCode,
  signInWithPassword,
  switchChallengeMethod,
  verifyChallenge,
} from "../auth/login";
import { devCodeFor } from "../notifications";
import { maskDestination } from "@/lib/utils";
import { requestPasswordReset, resetPassword } from "../auth/recovery";
import { revokeSession } from "../auth/session";
import type { LoginOutcome } from "../auth/types";
import { recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { getRequestContext } from "../request-context";

/** Persists the outcome of a sign-in step as cookies and tells the client where to go next. */
async function applyOutcome(outcome: LoginOutcome, next?: string | null) {
  if (outcome.kind === "mfa") {
    await setCookie(COOKIE.challenge(), outcome.challengeToken, outcome.expiresAt);
    const query = next ? `?next=${encodeURIComponent(safeNextPath(next))}` : "";
    return { redirectTo: `/sign-in/two-step${query}` };
  }
  await setCookie(COOKIE.session(), outcome.token, outcome.expiresAt);
  await clearCookie(COOKIE.challenge());
  return {
    redirectTo: isFullyVerified(outcome.user) ? await landingFor(outcome.user, next) : "/verify",
  };
}

export async function signUpAction(input: SignUpInput) {
  return runAction(async () => {
    await enforceRateLimit("signUp");
    const { token, expiresAt } = await signUp(input, await getRequestContext());
    await setCookie(COOKIE.session(), token, expiresAt);
    return { redirectTo: "/verify" };
  });
}

export async function signInAction(input: SignInInput) {
  return runAction(async () => {
    await enforceRateLimit(
      "signIn",
      typeof input.email === "string" ? input.email.toLowerCase() : "",
    );
    const outcome = await signInWithPassword(input, await getRequestContext());
    return applyOutcome(outcome, input.next);
  });
}

/** What the two-step screen shows for the active method; `devCode` is only set in APP_ENV=dev. */
export interface ChallengeView {
  method: MfaMethod;
  destination: string | null;
  devCode: string | null;
}

async function challengeView(token: string): Promise<ChallengeView> {
  const { method, destination } = await describeChallenge(token);
  return {
    method,
    destination: maskDestination(method, destination),
    devCode: method === "TOTP" ? null : await devCodeFor(destination, "mfaLoginCode"),
  };
}

async function challengeToken() {
  const token = await readCookie(COOKIE.challenge());
  if (!token) throw new AppError("challengeExpired");
  return token;
}

export async function verifyTwoStepAction(input: TwoStepInput, next?: string) {
  return runAction(async () => {
    await enforceRateLimit("otpVerify");
    const outcome = await verifyChallenge(await challengeToken(), input, await getRequestContext());
    return applyOutcome(outcome, next);
  });
}

export async function switchTwoStepMethodAction(method: string) {
  return runAction(async () => {
    await enforceRateLimit("otpSend");
    const token = await challengeToken();
    await switchChallengeMethod(token, z.enum(MFA_METHODS).parse(method));
    return challengeView(token);
  });
}

export async function resendTwoStepCodeAction() {
  return runAction(async () => {
    await enforceRateLimit("otpSend");
    const token = await challengeToken();
    await resendChallengeCode(token);
    return challengeView(token);
  });
}

async function sessionOrThrow() {
  const current = await getCurrentSession();
  if (!current) throw new AppError("unauthenticated");
  return current;
}

export async function sendVerificationCodeAction(channel: "EMAIL" | "PHONE") {
  return runAction(async () => {
    await enforceRateLimit("otpSend", channel);
    const { user } = await sessionOrThrow();
    const parsed = z.enum(["EMAIL", "PHONE"]).parse(channel);
    await sendContactCode(user, parsed);
    return {
      devCode:
        parsed === "EMAIL"
          ? await devCodeFor(user.email, "emailVerify")
          : await devCodeFor(user.phone, "phoneVerify"),
    };
  });
}

export async function verifyContactAction(input: z.input<typeof verifyContactSchema>) {
  return runAction(async () => {
    await enforceRateLimit("otpVerify");
    const { channel, code } = verifyContactSchema.parse(input);
    const { user } = await sessionOrThrow();
    const updated = await verifyContact(user, channel, code, await getRequestContext());
    return { complete: isFullyVerified(updated) };
  });
}

export async function forgotPasswordAction(input: z.input<typeof forgotPasswordSchema>) {
  return runAction(async () => {
    await enforceRateLimit("passwordReset");
    const { email } = forgotPasswordSchema.parse(input);
    await requestPasswordReset(email, await getRequestContext());
    return { email, devCode: await devCodeFor(email, "passwordReset") };
  });
}

export async function resetPasswordAction(input: Parameters<typeof resetPassword>[0]) {
  return runAction(async () => {
    await enforceRateLimit("otpVerify", "reset");
    await resetPassword(input, await getRequestContext());
    return null;
  });
}

export async function signOutAction() {
  const current = await getCurrentSession();
  if (current) {
    await revokeSession(current.session.id);
    await recordAudit({
      action: "auth.signout",
      entityType: "User",
      entityId: current.user.id,
      actorId: current.user.id,
      ...(await getRequestContext()),
    });
  }
  await clearCookie(COOKIE.session());
  redirect("/");
}

/** UX-003: remember the language choice (cookie, plus profile when signed in). */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const current = await getCurrentSession();
  if (current) await db.user.update({ where: { id: current.user.id }, data: { locale } });
}
