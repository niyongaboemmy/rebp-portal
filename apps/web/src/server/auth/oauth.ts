import "server-only";
import { maskEmail, recordAudit } from "../audit/audit";
import { db } from "../db";
import { AppError } from "../errors";
import { startLogin } from "./login";
import type { LoginOutcome, RequestContext } from "./types";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export type OAuthIntent = { mode: "signin" } | { mode: "link"; userId: string };

export type OAuthOutcome = LoginOutcome | { kind: "linked" };

/**
 * Resolves a verified Google identity. Existing accounts are never silently merged:
 * a user who already has a password account must sign in and link Google from Security settings.
 */
export async function handleGoogleIdentity(
  profile: GoogleProfile,
  intent: OAuthIntent,
  ctx: RequestContext,
): Promise<OAuthOutcome> {
  if (!profile.emailVerified) throw new AppError("googleEmailUnverified");
  const email = profile.email.toLowerCase();
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
    include: { user: true },
  });

  if (intent.mode === "link") {
    if (linked && linked.userId !== intent.userId) throw new AppError("googleLinkedElsewhere");
    if (!linked) {
      const existing = await db.oAuthAccount.findUnique({
        where: { userId_provider: { userId: intent.userId, provider: "google" } },
      });
      if (existing) throw new AppError("googleAlreadyLinked");
      await db.oAuthAccount.create({
        data: { provider: "google", providerAccountId: profile.sub, email, userId: intent.userId },
      });
      await recordAudit({
        action: "auth.google_linked",
        entityType: "User",
        entityId: intent.userId,
        actorId: intent.userId,
        ...ctx,
        metadata: { email: maskEmail(email) },
      });
    }
    return { kind: "linked" };
  }

  if (linked) return startLogin(linked.user, "google", ctx);

  if (await db.user.findUnique({ where: { email }, select: { id: true } }))
    throw new AppError("googleAccountExists");

  const user = await db.user.create({
    data: {
      email,
      emailVerifiedAt: new Date(),
      fullName: profile.name.trim() || email.split("@")[0]!,
      accountType: "INDIVIDUAL",
      roles: ["APPLICANT"],
      oauthAccounts: { create: { provider: "google", providerAccountId: profile.sub, email } },
    },
  });
  await recordAudit({
    action: "account.created",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...ctx,
    metadata: { method: "google", email: maskEmail(email) },
  });
  return startLogin(user, "google", ctx);
}

export async function unlinkGoogle(userId: string, ctx: RequestContext) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw new AppError("cannotUnlinkOnlyMethod");
  const { count } = await db.oAuthAccount.deleteMany({ where: { userId, provider: "google" } });
  if (count === 0) throw new AppError("googleNotLinked");
  await recordAudit({
    action: "auth.google_unlinked",
    entityType: "User",
    entityId: userId,
    actorId: userId,
    ...ctx,
  });
}
