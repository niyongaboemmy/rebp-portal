import "server-only";
import {
  PROFILE_DOCUMENT_TYPES,
  profileCompletion,
  sectionBSchema,
  type ApplicationData,
  type ProfileCompletion,
  type SectionB,
  type SectionContext,
} from "@rebp/contracts";
import type { Prisma, User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import { getConfig } from "../config/config";
import { db } from "../db";
import type { RequestContext } from "../request-context";
import { todayKigali } from "../time";

/**
 * Applicant profile (UX-010): the Section B answers kept on the account. Every application reuses
 * them, so an applicant types their personal details once; editing the profile updates their
 * drafts (and any application where an officer unlocked Section B). Only individual applicants
 * hold one — organisations and staff are never asked.
 */

export function needsProfile(user: Pick<User, "accountType" | "roles">): boolean {
  return user.accountType === "INDIVIDUAL" && user.roles.includes("APPLICANT");
}

export async function profileContext(): Promise<Pick<SectionContext, "today" | "flags">> {
  const flags = await getConfig("flags");
  return { today: todayKigali(), flags: { genderField: flags.value.genderField } };
}

/** The stored profile, or a start made from the account (name, email, phone). */
export function profileOf(user: Pick<User, "profile" | "fullName" | "email" | "phone">): SectionB {
  if (user.profile && typeof user.profile === "object") return user.profile as SectionB;
  const [givenNames, ...rest] = user.fullName.trim().split(/\s+/);
  return {
    givenNames,
    surname: rest.join(" ") || undefined,
    fullNameOnId: user.fullName,
    email: user.email,
    phone: user.phone ?? undefined,
    nationality: ["RW"],
  };
}

/** Which identity documents the profile holds as a clean file (UX-010). */
export async function profileDocumentFlags(userId: string): Promise<Record<string, boolean>> {
  const docs = await db.profileDocument.findMany({
    where: { userId, removedAt: null, status: { notIn: ["INFECTED", "REJECTED_FILE"] } },
    select: { type: true },
  });
  return Object.fromEntries(
    PROFILE_DOCUMENT_TYPES.map((type) => [type, docs.some((d) => d.type === type)]),
  );
}

export async function profileStatus(
  user: Pick<User, "id" | "profile" | "fullName" | "email" | "phone" | "accountType" | "roles">,
): Promise<ProfileCompletion & { required: boolean }> {
  const completion = profileCompletion(
    profileOf(user),
    await profileContext(),
    needsProfile(user) ? await profileDocumentFlags(user.id) : undefined,
  );
  return { ...completion, required: needsProfile(user) };
}

/**
 * True when the applicant must complete their profile before going on: the personal details.
 * The identity documents count toward the completion rate and are required to submit, but don't
 * hold the applicant back from the rest of the portal (they may not have the scans at hand).
 */
export async function profileBlocks(
  user: Pick<User, "profile" | "fullName" | "email" | "phone" | "accountType" | "roles">,
): Promise<boolean> {
  if (!needsProfile(user)) return false;
  return !profileCompletion(profileOf(user), await profileContext()).complete;
}

/**
 * Saves the profile and copies it into the applicant's open applications: drafts, and those an
 * officer sent back with Section B unlocked. Submitted ones keep the answers they were signed with.
 */
export async function saveProfile(user: User, input: SectionB, ctx: RequestContext) {
  const profile = sectionBSchema.parse(input);
  const json = JSON.parse(JSON.stringify(profile)) as Prisma.InputJsonValue;
  await db.user.update({
    where: { id: user.id },
    data: { profile: json, profileUpdatedAt: new Date() },
  });
  const completion = profileCompletion(profile, await profileContext());
  await recordAudit({
    action: "profile.updated",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    // Which answers, never their values (no PII in the audit trail).
    metadata: { answered: Object.keys(profile).length, complete: completion.complete },
  });

  const open = await db.application.findMany({
    where: {
      applicantId: user.id,
      category: { not: "REBF" },
      OR: [{ status: "DRAFT" }, { status: "ACTION_REQUIRED", unlockedSections: { has: "b" } }],
    },
    select: { id: true, data: true },
  });
  for (const app of open) {
    const data = (app.data ?? {}) as ApplicationData;
    if (JSON.stringify(data.b ?? {}) === JSON.stringify(profile)) continue;
    await db.application.update({
      where: { id: app.id },
      data: { data: JSON.parse(JSON.stringify({ ...data, b: profile })) },
    });
    await recordAudit({
      action: "application.section_updated",
      entityType: "Application",
      entityId: app.id,
      actorId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { section: "b", source: "profile" },
    });
  }
  return completion;
}

/**
 * Opening an editable application brings Section B in line with the profile (drafts made before
 * the profile existed, or changed since), and returns the data to show.
 */
export async function withProfile(
  app: { id: string; status: string; category: string; unlockedSections: string[]; data: unknown },
  user: User,
): Promise<ApplicationData> {
  const data = (app.data ?? {}) as ApplicationData;
  const open =
    app.status === "DRAFT" ||
    (app.status === "ACTION_REQUIRED" && app.unlockedSections.includes("b"));
  if (!open || app.category === "REBF" || !needsProfile(user) || !user.profile) return data;
  const profile = profileOf(user);
  if (JSON.stringify(data.b ?? {}) === JSON.stringify(profile)) return data;
  const next = { ...data, b: profile };
  await db.application.update({
    where: { id: app.id },
    data: { data: JSON.parse(JSON.stringify(next)) },
  });
  await recordAudit({
    action: "application.section_updated",
    entityType: "Application",
    entityId: app.id,
    actorId: user.id,
    metadata: { section: "b", source: "profile" },
  });
  return next;
}
