import "server-only";
import {
  canTransition,
  categoryAvailability,
  CATEGORY_INFO,
  checkSection,
  EDITABLE_STATUSES,
  formatReference,
  OPEN_STATUSES,
  sectionsFor,
  WITHDRAWABLE_STATUSES,
  type ApplicationData,
  type ApplicationStatus,
  type Category,
  type CreateApplicationInput,
  type SaveSectionInput,
  type SectionContext,
  type SectionKey,
  CV_SECTIONS,
  fromCv,
  isCvSection,
  cvMissingFor,
} from "@rebp/contracts";
import type { Application, Prisma, User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { getConfig } from "../config/config";
import { db } from "../db";
import { cvOf, saveCvSection } from "../profile/cv";
import { needsProfile, profileBlocks, profileOf } from "../profile/profile";
import { AppError } from "../errors";
import { todayKigali } from "../time";
import { heldLicenceSummaries, runEligibility } from "./facts";
import { nextSequence } from "./numbers";

/**
 * Applications (WP-1.1): create with a reference number (FR-A-001) after the type × category check
 * (FR-DOM-001), autosave sections (FR-WIZ-004), preserve data across category changes (FR-WIZ-009),
 * withdraw (FR-WF-005), and the guarded state machine (FR-WF-001).
 */

type Tx = Prisma.TransactionClient;

export const asData = (value: unknown): ApplicationData => (value ?? {}) as ApplicationData;

export async function sectionContext(
  app: Pick<Application, "type" | "category">,
): Promise<SectionContext> {
  const flags = await getConfig("flags");
  return {
    type: app.type,
    category: app.category,
    today: todayKigali(),
    flags: {
      genderField: flags.value.genderField,
      indemnityRequired: flags.value.indemnityRequired,
    },
  };
}

/**
 * Moves an application between states. The conditional update makes concurrent transitions safe:
 * only one caller can move it out of `from`. Every transition is on the timeline (FR-PORTAL-002).
 */
export async function transition(
  tx: Tx,
  app: Pick<Application, "id" | "status">,
  to: ApplicationStatus,
  {
    actorId,
    reason,
    data,
  }: {
    actorId?: string | null;
    reason?: string;
    data?: Prisma.ApplicationUpdateManyMutationInput;
  } = {},
) {
  if (!canTransition(app.status, to)) throw new AppError("invalidTransition");
  const { count } = await tx.application.updateMany({
    where: { id: app.id, status: app.status },
    data: { ...data, status: to, lastActivityAt: new Date() },
  });
  if (count === 0) throw new AppError("staleState");
  await tx.applicationEvent.create({
    data: {
      applicationId: app.id,
      fromStatus: app.status,
      toStatus: to,
      actorId: actorId ?? null,
      reason,
    },
  });
}

export async function auditTransition(
  app: Pick<Application, "id" | "referenceNo">,
  from: ApplicationStatus,
  to: ApplicationStatus,
  actorId: string | null,
  ctx: Partial<RequestContext> = {},
  reason?: string,
) {
  await recordAudit({
    action: "application.transition",
    entityType: "Application",
    entityId: app.id,
    actorId,
    metadata: { reference: app.referenceNo, from, to, ...(reason ? { reason } : {}) },
    ...ctx,
  });
}

/** The CV's sections for a new application, else the last submitted one's (UX-018). */
async function fromCvOrPrior(user: User, prior: ApplicationData) {
  const cv = await cvOf(user);
  return Object.fromEntries(
    CV_SECTIONS.map((key) => [
      key,
      cv[key] ? fromCv(key, cv[key] as never, undefined) : prior[key],
    ]),
  ) as Pick<ApplicationData, "c" | "d" | "e">;
}

/** Profile reuse (FR-ACC-009): identity and history from the applicant's latest submitted application. */
async function prefill(user: User, category: Category): Promise<ApplicationData> {
  const previous = await db.applicationSnapshot.findFirst({
    where: { application: { applicantId: user.id } },
    orderBy: { createdAt: "desc" },
    select: { data: true },
  });
  const prior = asData(previous?.data);
  if (category === "REBF") {
    return {
      g: {
        legalName: user.fullName.replace(/\s*\(.*\)\s*$/, ""),
        email: user.email,
        phone: user.phone ?? undefined,
      },
    };
  }
  return {
    // Section B is the applicant's profile (UX-010), kept on the account and reused here.
    b: user.profile ? profileOf(user) : (prior.b ?? profileOf(user)),
    // Education, training and experience come from the CV (UX-018).
    ...(await fromCvOrPrior(user, prior)),
  };
}

/**
 * FR-WIZ-010 / FR-E-007: an upgrade starts with the licensed period already declared from the
 * register (category, dates, firm); the applicant adds the duties and any other periods.
 */
async function experienceFromRegister(licenceId: string, current: ApplicationData["e"]) {
  const licence = await db.licence.findUniqueOrThrow({
    where: { id: licenceId },
    include: { affiliatedFirm: { select: { legalName: true } } },
  });
  const from = licence.issuedAt.toISOString().slice(0, 10);
  const records = current?.records ?? [];
  const already = records.some((r) => r.category === licence.category && r.from === from);
  return {
    ...current,
    currentCategory: licence.category,
    previousLicenceNo: licence.licenceNo,
    priorCategoryForExperience: current?.priorCategoryForExperience ?? (licence.category as "FSLA"),
    initialRegistrationDate: current?.initialRegistrationDate ?? from,
    records: already
      ? records
      : [
          {
            id: `reg-${licence.licenceNo}`,
            firm: licence.affiliatedFirm?.legalName,
            category: licence.category as "FSLA",
            from,
            current: licence.status === "ACTIVE",
          },
          ...records,
        ],
  };
}

export async function createApplication(
  user: User,
  input: CreateApplicationInput,
  ctx: RequestContext,
) {
  // Personal details come from the profile, so it must be complete first (UX-010).
  if (input.category !== "REBF" && (await profileBlocks(user)))
    throw new AppError("profileIncomplete", "errors.profileIncomplete");
  // Qualifications are part of the applicant (UX-021): the CV parts this category needs come
  // before applying.
  if (needsProfile(user)) {
    const missing = cvMissingFor(await cvOf(user), input.type, input.category, todayKigali());
    if (missing.length > 0)
      throw new AppError("cvIncomplete", "errors.cvIncomplete", undefined, {
        parts: missing.join(","),
      });
  }
  const licences = await heldLicenceSummaries(user.id);
  const available = categoryAvailability(input.type, input.category, {
    applicantType: user.accountType,
    licences,
  });
  if (!available.ok)
    throw new AppError("categoryUnavailable", `errors.categoryUnavailable`, undefined, {
      reason: available.reason,
    });

  let relatedLicenceId: string | null = null;
  let data: ApplicationData;
  if (input.type === "RENEWAL" || input.type === "UPGRADE") {
    const related = licences.find((l) =>
      input.relatedLicenceId
        ? l.id === input.relatedLicenceId
        : input.type === "RENEWAL"
          ? l.category === input.category && l.renewable
          : l.status === "ACTIVE",
    );
    if (!related) throw new AppError("licenceNotFound");
    if (input.type === "RENEWAL" && (related.category !== input.category || !related.renewable))
      throw new AppError("categoryUnavailable", "errors.categoryUnavailable", undefined, {
        reason: "needsLicence",
      });
    relatedLicenceId = related.id;
    // FR-WIZ-010: pre-populate from the licence's last application.
    const source = await db.licence.findUnique({
      where: { id: related.id },
      select: {
        application: {
          select: { snapshots: { orderBy: { version: "desc" }, take: 1, select: { data: true } } },
        },
      },
    });
    const prior = asData(source?.application?.snapshots[0]?.data);
    data =
      input.type === "RENEWAL"
        ? { b: prior.b, f: prior.f, g: prior.g, h: undefined }
        : { ...prior, f: undefined, g: undefined, h: undefined };
    if (!data.b) data = { ...(await prefill(user, input.category)), ...data };
    if (input.type === "UPGRADE")
      data = { ...data, e: await experienceFromRegister(related.id, data.e) };
  } else {
    data = await prefill(user, input.category);
  }

  // One open application per type and category keeps the applicant from splitting their work.
  const existing = await db.application.findFirst({
    where: {
      applicantId: user.id,
      type: input.type,
      category: input.category,
      status: { in: [...OPEN_STATUSES] },
    },
    select: { id: true },
  });
  if (existing)
    throw new AppError("applicationExists", "errors.applicationExists", undefined, {
      id: existing.id,
    });

  const seq = await nextSequence("application_ref_seq");
  const year = Number(todayKigali().slice(0, 4));
  const app = await db.$transaction(async (tx) => {
    const created = await tx.application.create({
      data: {
        referenceNo: formatReference(year, input.type, seq),
        type: input.type,
        category: input.category,
        applicantId: user.id,
        relatedLicenceId,
        data: JSON.parse(JSON.stringify(data)),
        lastStep: "a",
      },
    });
    await tx.applicationEvent.create({
      data: { applicationId: created.id, toStatus: "DRAFT", actorId: user.id, reason: "created" },
    });
    return created;
  });
  await recordAudit({
    action: "application.created",
    entityType: "Application",
    entityId: app.id,
    actorId: user.id,
    metadata: { reference: app.referenceNo, type: app.type, category: app.category },
    ...ctx,
  });
  return app;
}

/** Loads an application the user owns, or throws `notFound` (never reveals other applicants' data). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function ownApplication(id: string, user: Pick<User, "id">) {
  if (!UUID.test(id)) throw new AppError("notFound");
  const app = await db.application.findUnique({ where: { id } });
  if (!app || app.applicantId !== user.id) throw new AppError("notFound");
  return app;
}

/** FR-WF-002: editable in DRAFT; in ACTION_REQUIRED only what the request unlocked. */
export function canEditSection(
  app: Pick<Application, "status" | "unlockedSections">,
  section: SectionKey,
) {
  if (app.status === "DRAFT") return true;
  return app.status === "ACTION_REQUIRED" && app.unlockedSections.includes(section);
}

export function isEditable(app: Pick<Application, "status">) {
  return (EDITABLE_STATUSES as readonly string[]).includes(app.status);
}

const MAX_SECTION_BYTES = 100_000;

export async function saveSection(
  applicationId: string,
  input: SaveSectionInput,
  user: User,
  ctx: RequestContext,
  step?: string,
) {
  const app = await ownApplication(applicationId, user);
  if (!sectionsFor(app.type, app.category).includes(input.section))
    throw new AppError("sectionNotApplicable");
  if (!canEditSection(app, input.section)) throw new AppError("sectionLocked");
  if (JSON.stringify(input.data).length > MAX_SECTION_BYTES) throw new AppError("payloadTooLarge");

  const data = { ...asData(app.data), [input.section]: input.data } as ApplicationData;
  await db.application.update({
    where: { id: app.id },
    data: {
      data: JSON.parse(JSON.stringify(data)),
      lastActivityAt: new Date(),
      ...(step ? { lastStep: step } : {}),
    },
  });
  // Education, training and experience belong to the applicant's CV (UX-018): saved there too,
  // and so in their other open applications.
  if (isCvSection(input.section) && app.category !== "REBF")
    await saveCvSection(user, input.section, input.data, ctx, { exceptApplicationId: app.id });
  // Draft autosaves are not audited one by one (D-011): the signed snapshot captures the result.
  // Edits after submission are, because they change data an officer has seen.
  if (app.status === "ACTION_REQUIRED") {
    await recordAudit({
      action: "application.section_updated",
      entityType: "Application",
      entityId: app.id,
      actorId: user.id,
      metadata: { reference: app.referenceNo, section: input.section },
      ...ctx,
    });
  }
  const sctx = await sectionContext(app);
  const eligibility = await runEligibility(app, data);
  return { issues: checkSection(input.section, data, sctx), eligibility };
}

export async function rememberStep(applicationId: string, step: string, user: User) {
  const app = await ownApplication(applicationId, user);
  await db.application.update({ where: { id: app.id }, data: { lastStep: step } });
}

/** FR-WIZ-009: changing category keeps all data; sections that no longer apply are hidden, not lost. */
export async function changeCategory(
  applicationId: string,
  category: Category,
  user: User,
  ctx: RequestContext,
) {
  const app = await ownApplication(applicationId, user);
  if (app.status !== "DRAFT") throw new AppError("sectionLocked");
  if (app.type === "RENEWAL" || app.type === "FIRM_REGISTRATION")
    throw new AppError("categoryLocked");
  if (CATEGORY_INFO[category].applicantType !== CATEGORY_INFO[app.category].applicantType)
    throw new AppError("categoryLocked");
  const available = categoryAvailability(app.type, category, {
    applicantType: user.accountType,
    licences: await heldLicenceSummaries(user.id),
  });
  if (!available.ok)
    throw new AppError("categoryUnavailable", "errors.categoryUnavailable", undefined, {
      reason: available.reason,
    });
  await db.application.update({
    where: { id: app.id },
    data: { category, lastActivityAt: new Date() },
  });
  await recordAudit({
    action: "application.category_changed",
    entityType: "Application",
    entityId: app.id,
    actorId: user.id,
    metadata: { reference: app.referenceNo, from: app.category, to: category },
    ...ctx,
  });
}

export async function withdrawApplication(applicationId: string, user: User, ctx: RequestContext) {
  const app = await ownApplication(applicationId, user);
  if (!(WITHDRAWABLE_STATUSES as readonly string[]).includes(app.status))
    throw new AppError("invalidTransition");
  await db.$transaction(async (tx) => {
    await transition(tx, app, "WITHDRAWN", { actorId: user.id, reason: "withdrawn" });
    await tx.confirmationRequest.updateMany({
      where: { applicationId: app.id, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    await tx.informationRequest.updateMany({
      where: { applicationId: app.id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });
  });
  await auditTransition(app, app.status, "WITHDRAWN", user.id, ctx);
}

/** The applicant's applications for the list and dashboard (FR-PORTAL-001). */
export async function listApplications(userId: string) {
  return db.application.findMany({
    where: { applicantId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      infoRequests: { where: { status: "OPEN" }, select: { id: true, dueAt: true } },
      confirmations: { select: { status: true, kind: true } },
      payments: { where: { status: "PAID" }, select: { id: true } },
    },
  });
}

/** Full application for the owner's wizard and status page. */
export async function applicationForOwner(id: string, user: Pick<User, "id">) {
  if (!UUID.test(id)) return null;
  const app = await db.application.findUnique({
    where: { id },
    include: {
      events: { orderBy: { at: "asc" } },
      documents: {
        where: { removedAt: null },
        orderBy: { createdAt: "asc" },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      },
      payments: { orderBy: { createdAt: "desc" } },
      confirmations: {
        orderBy: { createdAt: "asc" },
        include: { addressee: { select: { fullName: true } } },
      },
      infoRequests: { orderBy: { createdAt: "desc" } },
      decisions: { orderBy: { signedAt: "desc" }, take: 1 },
      reviews: {
        where: { signedAt: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { applicantComment: true },
      },
      licences: { select: { id: true, licenceNo: true } },
      snapshots: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true, hash: true, createdAt: true },
      },
    },
  });
  if (!app || app.applicantId !== user.id) return null;
  return app;
}
