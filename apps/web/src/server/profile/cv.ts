import "server-only";
import {
  CV_SECTIONS,
  SECTION_SCHEMAS,
  cvCompletion,
  fromCv,
  sectionsFor,
  toCv,
  type ApplicationData,
  type Cv,
  type CvSection,
} from "@rebp/contracts";
import type { Prisma, User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import { db } from "../db";
import type { RequestContext } from "../request-context";
import { todayKigali } from "../time";
import { needsProfile } from "./profile";

/**
 * The applicant's CV (UX-018): education, training and experience kept on the account. It is
 * edited on the profile or in any application (each section saved there is saved here too), and
 * copied into every application that can still change it — drafts, and sections an officer
 * unlocked. Submitted applications keep what they were signed with.
 */

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/**
 * The stored CV; before there is one, what the applicant's latest application already holds, so
 * nobody types their history twice.
 */
export async function cvOf(user: Pick<User, "id" | "cv">): Promise<Cv> {
  if (user.cv && typeof user.cv === "object") return user.cv as Cv;
  const latest = await db.application.findFirst({
    where: { applicantId: user.id, category: { not: "REBF" } },
    orderBy: { updatedAt: "desc" },
    select: { data: true },
  });
  const data = (latest?.data ?? {}) as ApplicationData;
  return Object.fromEntries(
    CV_SECTIONS.filter((key) => data[key]).map((key) => [key, toCv(key, data[key] as never)]),
  ) as Cv;
}

type OpenApplication = {
  id: string;
  type: string;
  category: string;
  status: string;
  unlockedSections: string[];
  data: unknown;
};

const canTake = (app: OpenApplication, section: CvSection) =>
  app.category !== "REBF" &&
  sectionsFor(app.type as never, app.category as never).includes(section) &&
  (app.status === "DRAFT" ||
    (app.status === "ACTION_REQUIRED" && app.unlockedSections.includes(section)));

/** Saves one CV section and copies it into the applicant's other open applications. */
export async function saveCvSection(
  user: User,
  section: CvSection,
  input: unknown,
  ctx: RequestContext,
  options: { exceptApplicationId?: string } = {},
) {
  if (!needsProfile(user)) return null;
  const parsed = SECTION_SCHEMAS[section].parse(input) as Cv[CvSection];
  const current = await cvOf(user);
  const cv: Cv = { ...current, [section]: toCv(section, parsed as never) };
  if (!same(current[section], cv[section]) || !user.cv) {
    await db.user.update({
      where: { id: user.id },
      data: { cv: json(cv), cvUpdatedAt: new Date() },
    });
    await recordAudit({
      action: "profile.cv_updated",
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      // Which section, never its contents.
      metadata: { section },
      ...ctx,
    });
  }

  const open = await db.application.findMany({
    where: {
      applicantId: user.id,
      id: options.exceptApplicationId ? { not: options.exceptApplicationId } : undefined,
      OR: [{ status: "DRAFT" }, { status: "ACTION_REQUIRED", unlockedSections: { has: section } }],
    },
    select: {
      id: true,
      type: true,
      category: true,
      status: true,
      unlockedSections: true,
      data: true,
    },
  });
  for (const app of open) {
    if (!canTake(app, section)) continue;
    const data = (app.data ?? {}) as ApplicationData;
    const next = fromCv(section, cv[section] as never, data[section] as never);
    if (same(data[section], next)) continue;
    await db.application.update({
      where: { id: app.id },
      data: { data: json({ ...data, [section]: next }) },
    });
    await recordAudit({
      action: "application.section_updated",
      entityType: "Application",
      entityId: app.id,
      actorId: user.id,
      metadata: { section, source: "cv" },
      ...ctx,
    });
  }
  return cvCompletion(cv, todayKigali());
}

/**
 * Opening an editable application brings its CV sections in line with the CV (drafts made before
 * the CV existed or changed since), and returns the data to show.
 */
export async function withCv(
  app: OpenApplication,
  user: User,
  data: ApplicationData,
): Promise<ApplicationData> {
  if (!needsProfile(user) || !user.cv) return data;
  const cv = user.cv as Cv;
  let next = data;
  const changed: CvSection[] = [];
  for (const section of CV_SECTIONS) {
    if (!cv[section] || !canTake(app, section)) continue;
    const value = fromCv(section, cv[section] as never, next[section] as never);
    if (same(next[section], value)) continue;
    next = { ...next, [section]: value };
    changed.push(section);
  }
  if (changed.length === 0) return data;
  await db.application.update({ where: { id: app.id }, data: { data: json(next) } });
  for (const section of changed)
    await recordAudit({
      action: "application.section_updated",
      entityType: "Application",
      entityId: app.id,
      actorId: user.id,
      metadata: { section, source: "cv" },
    });
  return next;
}
