import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ctx, latestCode, resetDatabase } from "@/test/db";
import { isFullyVerified, signUp, updatePhone, verifyContact } from "../account";
import { decrypt } from "../crypto";
import {
  signInWithPassword,
  switchChallengeMethod,
  verifyChallenge,
  MAX_FAILED_LOGINS,
} from "../login";
import {
  beginOtpEnrolment,
  beginTotpEnrolment,
  confirmEnrolment,
  disableMfaMethod,
  regenerateRecoveryCodes,
} from "../mfa";
import { handleGoogleIdentity, unlinkGoogle } from "../oauth";
import { changePassword, requestPasswordReset, resetPassword } from "../recovery";
import {
  createSession,
  revokeUserSessions,
  validateSessionToken,
  type SessionWithUser,
} from "../session";
import { hasRecentAuth, reauthenticate, STEP_UP_WINDOW_MS } from "../step-up";
import { totp } from "../totp";

const PASSWORD = "sunny-kigali-hills-at-dawn";

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (error) => error instanceof AppError && error.code === code,
  );
}

async function registerUser(
  overrides: Partial<{ email: string; phone: string; fullName: string }> = {},
) {
  const email = overrides.email ?? "aline@example.rw";
  const phone = overrides.phone ?? "0788123456";
  const result = await signUp(
    {
      accountType: "INDIVIDUAL",
      fullName: overrides.fullName ?? "Aline Uwase",
      email,
      phone,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      acceptPrivacy: true,
    },
    ctx,
  );
  return result;
}

async function sessionFor(token: string): Promise<SessionWithUser> {
  const result = await validateSessionToken(token);
  if ("invalid" in result) throw new Error(`session invalid: ${result.invalid}`);
  return result;
}

async function verifiedUser() {
  const { user, token } = await registerUser();
  await verifyContact(user, "EMAIL", await latestCode(user.email, "emailVerify"), ctx);
  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  await verifyContact(fresh, "PHONE", await latestCode(fresh.phone!, "phoneVerify"), ctx);
  return { token, user: await db.user.findUniqueOrThrow({ where: { id: user.id } }) };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("sign-up and verification (FR-ACC-001…003)", () => {
  it("creates an unverified applicant with a live session and sends both codes", async () => {
    const { user, token } = await registerUser();
    expect(user.roles).toEqual(["APPLICANT"]);
    expect(user.phone).toBe("+250788123456");
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(isFullyVerified(user)).toBe(false);
    expect((await sessionFor(token)).user.id).toBe(user.id);
    const sent = await db.notificationLog.findMany({ where: {}, orderBy: { createdAt: "asc" } });
    expect(sent.map((m) => [m.channel, m.template]).sort()).toEqual([
      ["EMAIL", "emailVerify"],
      ["SMS", "phoneVerify"],
    ]);
  });

  it("blocks duplicate email and phone, pointing to recovery", async () => {
    await registerUser();
    const duplicate = registerUser({ email: "ALINE@example.rw", phone: "+250788123456" });
    await expect(duplicate).rejects.toMatchObject({
      code: "duplicateAccount",
      fieldErrors: { email: "errors.emailTaken", phone: "errors.phoneTaken" },
    });
  });

  it("rejects passwords containing the applicant's name", async () => {
    await expect(
      signUp(
        {
          accountType: "INDIVIDUAL",
          fullName: "Aline Uwase",
          email: "a@x.rw",
          phone: "0788000001",
          password: "aline-uwase-2026!!",
          confirmPassword: "aline-uwase-2026!!",
          acceptPrivacy: true,
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "passwordContainsPersonalInfo" });
  });

  it("verifies email and phone, rejecting wrong codes and locking after 5 attempts", async () => {
    const { user } = await registerUser();
    await expectAppError(verifyContact(user, "EMAIL", "000000", ctx), "codeInvalid");
    const verified = await verifyContact(
      user,
      "EMAIL",
      await latestCode(user.email, "emailVerify"),
      ctx,
    );
    expect(verified.emailVerifiedAt).not.toBeNull();

    for (let i = 0; i < 5; i++)
      await expectAppError(verifyContact(verified, "PHONE", "000000", ctx), "codeInvalid");
    await expectAppError(
      verifyContact(verified, "PHONE", await latestCode(user.phone!, "phoneVerify"), ctx),
      "tooManyAttempts",
    );
  });

  it("does not accept a code twice", async () => {
    const { user } = await registerUser();
    const code = await latestCode(user.email, "emailVerify");
    await verifyContact(user, "EMAIL", code, ctx);
    await expectAppError(verifyContact(user, "EMAIL", code, ctx), "codeInvalid");
  });

  it("re-verifies a changed phone and audits it (FR-ACC-008)", async () => {
    const { user } = await verifiedUser();
    const updated = await updatePhone(user, "+250788999999", ctx);
    expect(updated.phoneVerifiedAt).toBeNull();
    expect(await latestCode("+250788999999", "phoneVerify")).toMatch(/^\d{6}$/);
    expect(
      await db.auditEvent.count({ where: { entityId: user.id, action: "account.phone_changed" } }),
    ).toBe(1);
  });
});

describe("password sign-in (FR-ACC-004, SEC-006)", () => {
  it("issues a session when two-step is off", async () => {
    await verifiedUser();
    const outcome = await signInWithPassword(
      { email: "aline@example.rw", password: PASSWORD },
      ctx,
    );
    expect(outcome.kind).toBe("session");
  });

  it("uses one generic error for unknown users and wrong passwords", async () => {
    await verifiedUser();
    await expectAppError(
      signInWithPassword({ email: "nobody@example.rw", password: PASSWORD }, ctx),
      "invalidCredentials",
    );
    await expectAppError(
      signInWithPassword({ email: "aline@example.rw", password: "wrong-password-here" }, ctx),
      "invalidCredentials",
    );
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} failures, even for the right password`, async () => {
    const { user } = await verifiedUser();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await expectAppError(
        signInWithPassword({ email: "aline@example.rw", password: "wrong-password-here" }, ctx),
        "invalidCredentials",
      );
    }
    await expectAppError(
      signInWithPassword({ email: "aline@example.rw", password: PASSWORD }, ctx),
      "accountLocked",
    );
    expect(await db.auditEvent.count({ where: { action: "auth.locked", entityId: user.id } })).toBe(
      1,
    );
  });
});

describe("two-step verification", () => {
  async function enrolTotp() {
    const { user, token } = await verifiedUser();
    const { session } = await sessionFor(token);
    const { secret, qrDataUrl } = await beginTotpEnrolment(user);
    expect(qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    const pending = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(decrypt(pending.totpPendingSecretEnc!)).toBe(secret);
    const result = await confirmEnrolment(pending, session, "TOTP", totp(secret), ctx);
    return { secret, result, session };
  }

  it("enrols an authenticator app, returns 10 recovery codes and marks the session verified", async () => {
    const { result, session } = await enrolTotp();
    expect(result.user.mfaMethods).toEqual(["TOTP"]);
    expect(result.user.mfaPreferred).toBe("TOTP");
    expect(result.user.totpPendingSecretEnc).toBeNull();
    expect(result.recoveryCodes).toHaveLength(10);
    expect(result.recoveryCodes![0]).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).mfaVerified).toBe(
      true,
    );
  });

  it("rejects a wrong enrolment code", async () => {
    const { user, token } = await verifiedUser();
    const { session } = await sessionFor(token);
    await beginTotpEnrolment(user);
    const pending = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    await expectAppError(confirmEnrolment(pending, session, "TOTP", "000000", ctx), "codeInvalid");
  });

  it("challenges after the password and accepts a fresh TOTP code once", async () => {
    const { secret } = await enrolTotp();
    const first = await signInWithPassword({ email: "aline@example.rw", password: PASSWORD }, ctx);
    expect(first).toMatchObject({ kind: "mfa", method: "TOTP" });
    if (first.kind !== "mfa") throw new Error();

    await expectAppError(
      verifyChallenge(first.challengeToken, { kind: "code", code: "000000" }, ctx),
      "codeInvalid",
    );
    // The enrolment already used the current step, so use the next one (still inside the ±1 window).
    const code = totp(secret, Date.now() + 30_000);
    const done = await verifyChallenge(first.challengeToken, { kind: "code", code }, ctx);
    expect(done.kind).toBe("session");
    if (done.kind === "session")
      expect((await sessionFor(done.token)).session.mfaVerified).toBe(true);

    // The challenge is single-use, and the same TOTP code cannot be replayed on a new one.
    await expectAppError(
      verifyChallenge(first.challengeToken, { kind: "code", code }, ctx),
      "challengeExpired",
    );
    const second = await signInWithPassword({ email: "aline@example.rw", password: PASSWORD }, ctx);
    if (second.kind !== "mfa") throw new Error();
    await expectAppError(
      verifyChallenge(second.challengeToken, { kind: "code", code }, ctx),
      "codeInvalid",
    );
  });

  it("invalidates the challenge after too many wrong codes", async () => {
    await enrolTotp();
    const outcome = await signInWithPassword(
      { email: "aline@example.rw", password: PASSWORD },
      ctx,
    );
    if (outcome.kind !== "mfa") throw new Error();
    for (let i = 0; i < 5; i++) {
      await expectAppError(
        verifyChallenge(outcome.challengeToken, { kind: "code", code: "000000" }, ctx),
        "codeInvalid",
      );
    }
    await expectAppError(
      verifyChallenge(outcome.challengeToken, { kind: "code", code: "000000" }, ctx),
      "tooManyAttempts",
    );
  });

  it("accepts each recovery code once", async () => {
    const { result } = await enrolTotp();
    const recovery = result.recoveryCodes![0]!;
    const a = await signInWithPassword({ email: "aline@example.rw", password: PASSWORD }, ctx);
    if (a.kind !== "mfa") throw new Error();
    expect(
      (
        await verifyChallenge(
          a.challengeToken,
          { kind: "recovery", code: recovery.toLowerCase() },
          ctx,
        )
      ).kind,
    ).toBe("session");
    const b = await signInWithPassword({ email: "aline@example.rw", password: PASSWORD }, ctx);
    if (b.kind !== "mfa") throw new Error();
    await expectAppError(
      verifyChallenge(b.challengeToken, { kind: "recovery", code: recovery }, ctx),
      "codeInvalid",
    );
  });

  it("supports SMS and email codes, preferred method and switching", async () => {
    const { user, token } = await verifiedUser();
    const { session } = await sessionFor(token);
    await beginOtpEnrolment(user, "SMS");
    await confirmEnrolment(
      user,
      session,
      "SMS",
      await latestCode(user.phone!, "mfaEnrolCode"),
      ctx,
    );
    let fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    await beginOtpEnrolment(fresh, "EMAIL");
    const withEmail = await confirmEnrolment(
      fresh,
      session,
      "EMAIL",
      await latestCode(user.email, "mfaEnrolCode"),
      ctx,
    );
    expect(withEmail.recoveryCodes).toBeUndefined();
    expect(withEmail.user.mfaMethods).toEqual(["SMS", "EMAIL"]);

    const outcome = await signInWithPassword({ email: user.email, password: PASSWORD }, ctx);
    expect(outcome).toMatchObject({ kind: "mfa", method: "SMS", methods: ["SMS", "EMAIL"] });
    if (outcome.kind !== "mfa") throw new Error();

    await switchChallengeMethod(outcome.challengeToken, "EMAIL");
    const emailCode = await latestCode(user.email, "mfaLoginCode");
    expect(
      (await verifyChallenge(outcome.challengeToken, { kind: "code", code: emailCode }, ctx)).kind,
    ).toBe("session");

    fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    await expectAppError(updatePhone(fresh, "+250788777777", ctx), "disableSmsFirst");
  });

  it("refuses SMS enrolment before the phone is verified", async () => {
    const { user } = await registerUser();
    await expectAppError(beginOtpEnrolment(user, "SMS"), "phoneNotVerified");
  });

  it("lets applicants turn two-step off but not staff (FR-ACC-004)", async () => {
    await enrolTotp();
    const applicant = await db.user.findUniqueOrThrow({ where: { email: "aline@example.rw" } });
    await disableMfaMethod(applicant, "TOTP", ctx);
    const off = await db.user.findUniqueOrThrow({ where: { id: applicant.id } });
    expect(off.mfaMethods).toEqual([]);
    expect(off.totpSecretEnc).toBeNull();
    expect(await db.recoveryCode.count({ where: { userId: applicant.id } })).toBe(0);

    const staff = await db.user.update({
      where: { id: applicant.id },
      data: { roles: ["REVIEWING_OFFICER"], mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
    });
    await expectAppError(disableMfaMethod(staff, "EMAIL", ctx), "mfaRequiredForRole");
  });

  it("replaces recovery codes on regeneration", async () => {
    const { result } = await enrolTotp();
    const user = result.user;
    const fresh = await regenerateRecoveryCodes(user.id, ctx);
    expect(fresh).toHaveLength(10);
    expect(fresh).not.toEqual(result.recoveryCodes);
    expect(await db.recoveryCode.count({ where: { userId: user.id } })).toBe(10);
  });
});

describe("password recovery and change (FR-ACC-007)", () => {
  it("resets with an emailed code, revokes every session and notifies", async () => {
    const { user, token } = await verifiedUser();
    await requestPasswordReset(user.email, ctx);
    const code = await latestCode(user.email, "passwordReset");
    await resetPassword(
      {
        email: user.email,
        code,
        password: "a-brand-new-passphrase",
        confirmPassword: "a-brand-new-passphrase",
      },
      ctx,
    );

    expect(await validateSessionToken(token)).toEqual({ invalid: "revoked" });
    await expectAppError(
      signInWithPassword({ email: user.email, password: PASSWORD }, ctx),
      "invalidCredentials",
    );
    expect(
      (await signInWithPassword({ email: user.email, password: "a-brand-new-passphrase" }, ctx))
        .kind,
    ).toBe("session");
    expect(
      await db.notificationLog.count({
        where: { recipient: user.email, template: "passwordChanged" },
      }),
    ).toBe(1);
  });

  it("does not reveal whether an email is registered", async () => {
    await expect(requestPasswordReset("ghost@example.rw", ctx)).resolves.toBeUndefined();
    expect(await db.notificationLog.count({ where: { recipient: "ghost@example.rw" } })).toBe(0);
  });

  it("changes the password with the current one and signs out other sessions", async () => {
    const { user, token } = await verifiedUser();
    const other = await createSession(user, { method: "password", mfaVerified: false });
    const { session } = await sessionFor(token);
    await expectAppError(
      changePassword(
        user,
        session,
        {
          currentPassword: "nope-nope-nope",
          password: "another-good-passphrase",
          confirmPassword: "another-good-passphrase",
        },
        ctx,
      ),
      "invalidPassword",
    );
    await changePassword(
      user,
      session,
      {
        currentPassword: PASSWORD,
        password: "another-good-passphrase",
        confirmPassword: "another-good-passphrase",
      },
      ctx,
    );
    expect("session" in (await validateSessionToken(token))).toBe(true);
    expect(await validateSessionToken(other.token)).toEqual({ invalid: "revoked" });
  });
});

describe("Google sign-in", () => {
  const profile = {
    sub: "google-123",
    email: "Grace@Gmail.com",
    emailVerified: true,
    name: "Grace Ingabire",
  };

  it("creates a new verified-email applicant without a password", async () => {
    const outcome = await handleGoogleIdentity(profile, { mode: "signin" }, ctx);
    expect(outcome.kind).toBe("session");
    const user = await db.user.findUniqueOrThrow({
      where: { email: "grace@gmail.com" },
      include: { oauthAccounts: true },
    });
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.phone).toBeNull();
    expect(user.oauthAccounts).toHaveLength(1);
    // Signing in again finds the same account.
    await handleGoogleIdentity(profile, { mode: "signin" }, ctx);
    expect(await db.user.count()).toBe(1);
  });

  it("never silently merges into an existing password account", async () => {
    await verifiedUser();
    await expectAppError(
      handleGoogleIdentity({ ...profile, email: "aline@example.rw" }, { mode: "signin" }, ctx),
      "googleAccountExists",
    );
  });

  it("rejects unverified Google emails", async () => {
    await expectAppError(
      handleGoogleIdentity({ ...profile, emailVerified: false }, { mode: "signin" }, ctx),
      "googleEmailUnverified",
    );
  });

  it("links to a signed-in account, then signs in through the linked identity with two-step", async () => {
    const { user, token } = await verifiedUser();
    expect(
      await handleGoogleIdentity(
        { ...profile, email: "other@gmail.com" },
        { mode: "link", userId: user.id },
        ctx,
      ),
    ).toEqual({ kind: "linked" });

    const { session } = await sessionFor(token);
    await beginOtpEnrolment(user, "EMAIL");
    await confirmEnrolment(
      user,
      session,
      "EMAIL",
      await latestCode(user.email, "mfaEnrolCode"),
      ctx,
    );

    const outcome = await handleGoogleIdentity(
      { ...profile, email: "other@gmail.com" },
      { mode: "signin" },
      ctx,
    );
    expect(outcome).toMatchObject({ kind: "mfa", method: "EMAIL" });

    const intruder = await registerUser({
      email: "intruder@example.rw",
      phone: "0788000002",
      fullName: "Someone Else",
    });
    await expectAppError(
      handleGoogleIdentity(profile, { mode: "link", userId: intruder.user.id }, ctx),
      "googleLinkedElsewhere",
    );
  });

  it("only unlinks Google when a password exists", async () => {
    await handleGoogleIdentity(profile, { mode: "signin" }, ctx);
    const googleOnly = await db.user.findUniqueOrThrow({ where: { email: "grace@gmail.com" } });
    await expectAppError(unlinkGoogle(googleOnly.id, ctx), "cannotUnlinkOnlyMethod");

    const { user } = await verifiedUser();
    await handleGoogleIdentity(
      { ...profile, sub: "google-456", email: "x@gmail.com" },
      { mode: "link", userId: user.id },
      ctx,
    );
    await unlinkGoogle(user.id, ctx);
    expect(await db.oAuthAccount.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("sessions (FR-ACC-010) and step-up (SEC-005)", () => {
  it("expires idle applicant sessions after 30 minutes and staff after 15", async () => {
    const { user } = await verifiedUser();
    const applicant = await createSession(user, { method: "password", mfaVerified: false });
    expect(
      "session" in (await validateSessionToken(applicant.token, Date.now() + 29 * 60_000)),
    ).toBe(true);
    // The check above touched lastActiveAt; idle time counts from there.
    expect(
      await validateSessionToken(applicant.token, Date.now() + 29 * 60_000 + 31 * 60_000),
    ).toEqual({ invalid: "idle" });

    const staff = await createSession(
      { ...user, roles: ["REGISTRAR"] },
      { method: "password", mfaVerified: true },
    );
    await db.user.update({ where: { id: user.id }, data: { roles: ["REGISTRAR"] } });
    expect(await validateSessionToken(staff.token, Date.now() + 16 * 60_000)).toEqual({
      invalid: "idle",
    });
  });

  it("enforces the absolute lifetime and revocation", async () => {
    const { user } = await verifiedUser();
    const s = await createSession(user, { method: "password", mfaVerified: false });
    await db.session.update({
      where: { id: s.session.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(await validateSessionToken(s.token)).toEqual({ invalid: "expired" });

    const t = await createSession(user, { method: "password", mfaVerified: false });
    expect(await revokeUserSessions(user.id)).toBeGreaterThanOrEqual(1);
    expect(await validateSessionToken(t.token)).toEqual({ invalid: "revoked" });
    expect(await validateSessionToken("not-a-token")).toEqual({ invalid: "missing" });
  });

  it("requires recent authentication for sensitive changes", async () => {
    const { user, token } = await verifiedUser();
    const { session } = await sessionFor(token);
    expect(hasRecentAuth(session)).toBe(true);
    expect(hasRecentAuth(session, Date.now() + STEP_UP_WINDOW_MS + 1000)).toBe(false);

    await db.session.update({
      where: { id: session.id },
      data: { authenticatedAt: new Date(Date.now() - STEP_UP_WINDOW_MS - 1000) },
    });
    await expectAppError(reauthenticate(user, session, "wrong-password", ctx), "invalidPassword");
    await reauthenticate(user, session, PASSWORD, ctx);
    expect(hasRecentAuth(await db.session.findUniqueOrThrow({ where: { id: session.id } }))).toBe(
      true,
    );
  });
});
