import "server-only";
import {
  buildChecklist,
  DOCUMENT_RULES,
  PROFILE_DOCUMENT_TYPES,
  PROFILE_STORED_DOCUMENT_TYPES,
  type ApplicationData,
  type DocumentType,
} from "@rebp/contracts";
import type { Application, User } from "@/generated/prisma/client";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { cleanName, inspectUpload, isDocumentType, storageKey } from "../documents/documents";
import { AppError } from "../errors";
import { blobStore, sha256Hex } from "../storage/blob-store";
import { keepsProfile, needsProfile, profileStatus } from "./profile";

/**
 * Identity documents on the applicant profile (UX-010): proof of identity and the passport
 * photo, uploaded once with the same checks and encrypted storage as application documents,
 * and copied into each open application (Document.fromProfile) so officers verify the copy that
 * was submitted. Copies follow the profile while an application is a draft (or the officer
 * unlocked that document); files added directly to an application are never touched.
 */

const isProfileType = (type: string): type is DocumentType =>
  isDocumentType(type) && PROFILE_STORED_DOCUMENT_TYPES.includes(type);

const blocked = (status: string) => status === "INFECTED" || status === "REJECTED_FILE";

export async function listProfileDocuments(userId: string) {
  return db.profileDocument.findMany({
    where: { userId, removedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

/** Which profile document types are present (a clean file), for the completion rate. */
export async function profileDocumentsPresent(userId: string) {
  const docs = await listProfileDocuments(userId);
  return Object.fromEntries(
    PROFILE_DOCUMENT_TYPES.map((type) => [
      type,
      docs.some((d) => d.type === type && !blocked(d.status)),
    ]),
  ) as Record<DocumentType, boolean>;
}

/** The current profile photo's URL, for the account menu's avatar (UX-015); null when none. */
export async function profilePhotoUrl(userId: string) {
  const photo = await db.profileDocument.findFirst({
    where: {
      userId,
      type: "photo",
      removedAt: null,
      status: { notIn: ["INFECTED", "REJECTED_FILE"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return photo ? `/api/profile/documents/${photo.id}` : null;
}

/**
 * The photo-in-ring the account pages open with (UX-013): profile completion and the current
 * photo. Accounts without a personal profile get neither.
 */
export async function accountAvatar(user: User) {
  if (!keepsProfile(user)) return { percent: null, photoHref: null };
  const [status, docs] = await Promise.all([profileStatus(user), listProfileDocuments(user.id)]);
  const photo = docs.find((d) => d.type === "photo" && !blocked(d.status));
  return {
    percent: status.percent,
    photoHref: photo ? `/api/profile/documents/${photo.id}` : null,
  };
}

export async function uploadProfileDocument(
  user: User,
  input: { type: string; replaceId?: string; fileName: string; bytes: Buffer },
  ctx: RequestContext,
) {
  if (!keepsProfile(user)) throw new AppError("forbidden");
  if (!isProfileType(input.type)) throw new AppError("documentTypeInvalid");
  const { mime, status, scanDetail } = await inspectUpload(input.type, input.bytes, input.fileName);
  const rule = DOCUMENT_RULES[input.type];

  const replacing = input.replaceId
    ? await db.profileDocument.findFirst({
        where: { id: input.replaceId, userId: user.id, type: input.type, removedAt: null },
      })
    : null;
  if (input.replaceId && !replacing) throw new AppError("notFound");
  if (!replacing) {
    const count = await db.profileDocument.count({
      where: {
        userId: user.id,
        type: input.type,
        removedAt: null,
        status: { notIn: ["INFECTED", "REJECTED_FILE"] },
      },
    });
    if (count >= rule.maxFiles)
      throw new AppError("tooManyFiles", "errors.tooManyFiles", undefined, { max: rule.maxFiles });
  }

  // Infected files are never stored (quarantine = discarded + recorded, FR-DOC-004).
  const key = storageKey();
  if (status !== "INFECTED") await blobStore.put(key, input.bytes);
  const sha256 = sha256Hex(input.bytes);
  const fileName = cleanName(input.fileName);
  const doc = await db.$transaction(async (tx) => {
    if (replacing)
      await tx.profileDocument.update({
        where: { id: replacing.id },
        data: { removedAt: new Date() },
      });
    return tx.profileDocument.create({
      data: {
        userId: user.id,
        type: input.type,
        fileName,
        mimeType: mime,
        size: input.bytes.length,
        sha256,
        storageKey: status === "INFECTED" ? `quarantine/${key}` : key,
        status,
        scanDetail,
      },
    });
  });
  await recordAudit({
    action: status === "INFECTED" ? "profile.document_quarantined" : "profile.document_uploaded",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    metadata: { type: input.type, status, sha256, replaced: Boolean(replacing) },
    ...ctx,
  });
  await syncOpenApplications(user, ctx);
  return {
    id: doc.id,
    status,
    version: 1,
    fileName,
    size: input.bytes.length,
    mimeType: mime,
  };
}

export async function removeProfileDocument(user: User, id: string, ctx: RequestContext) {
  const doc = await db.profileDocument.findFirst({
    where: { id, userId: user.id, removedAt: null },
  });
  if (!doc) throw new AppError("notFound");
  await db.profileDocument.update({ where: { id }, data: { removedAt: new Date() } });
  await recordAudit({
    action: "profile.document_removed",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    metadata: { type: doc.type },
    ...ctx,
  });
  await syncOpenApplications(user, ctx);
}

/** The owner reads their own profile document; nobody else (staff read the application copy). */
export async function readProfileDocument(id: string, viewer: User) {
  const doc = await db.profileDocument.findFirst({
    where: { id, userId: viewer.id, removedAt: null },
  });
  if (!doc || blocked(doc.status)) throw new AppError("notFound");
  return {
    bytes: await blobStore.get(doc.storageKey),
    mimeType: doc.mimeType,
    fileName: doc.fileName,
  };
}

type SyncableApplication = Pick<
  Application,
  "id" | "type" | "category" | "status" | "data" | "unlockedDocuments" | "referenceNo"
>;

/**
 * Brings an application's identity documents in line with the profile: copies of current
 * profile files are added, copies of replaced or removed ones withdrawn. Only while the
 * application can change that document, and never where the applicant uploaded one directly.
 */
export async function syncProfileDocuments(
  app: SyncableApplication,
  user: User,
  ctx?: RequestContext,
): Promise<boolean> {
  if (!needsProfile(user) || app.category === "REBF") return false;
  const needed = new Set(
    buildChecklist({
      type: app.type,
      category: app.category,
      data: (app.data ?? {}) as ApplicationData,
    }).map((i) => i.type),
  );
  const profileDocs = (await listProfileDocuments(user.id)).filter((d) => !blocked(d.status));
  let changed = false;

  for (const type of PROFILE_STORED_DOCUMENT_TYPES) {
    const editable =
      app.status === "DRAFT" ||
      (app.status === "ACTION_REQUIRED" && app.unlockedDocuments.includes(type));
    if (!editable || !needed.has(type)) continue;
    const current = await db.document.findMany({
      where: { applicationId: app.id, type, removedAt: null },
      include: { versions: true },
    });
    // The applicant's own uploads win: no copies next to them.
    if (current.some((d) => !d.fromProfile)) continue;
    const want = profileDocs.filter((d) => d.type === type);
    const shaOf = (d: (typeof current)[number]) =>
      d.versions.find((v) => v.version === d.currentVersion)?.sha256;

    for (const copy of current) {
      if (want.some((p) => p.sha256 === shaOf(copy))) continue;
      await db.document.update({ where: { id: copy.id }, data: { removedAt: new Date() } });
      changed = true;
    }
    for (const source of want) {
      if (current.some((c) => shaOf(c) === source.sha256)) continue;
      // Each application keeps its own encrypted copy, so it stays as it was submitted.
      const key = storageKey();
      await blobStore.put(key, await blobStore.get(source.storageKey));
      const doc = await db.document.create({
        data: {
          applicationId: app.id,
          type,
          ownerId: user.id,
          status: "CLEAN",
          currentVersion: 1,
          fromProfile: true,
          versions: {
            create: {
              version: 1,
              fileName: source.fileName,
              mimeType: source.mimeType,
              size: source.size,
              sha256: source.sha256,
              storageKey: key,
              scanStatus: "CLEAN",
              uploadedById: user.id,
            },
          },
        },
      });
      await recordAudit({
        action: "document.copied_from_profile",
        entityType: "Document",
        entityId: doc.id,
        actorId: user.id,
        metadata: { reference: app.referenceNo, type, sha256: source.sha256 },
        ...(ctx ?? {}),
      });
      changed = true;
    }
  }
  return changed;
}

async function syncOpenApplications(user: User, ctx: RequestContext) {
  const open = await db.application.findMany({
    where: {
      applicantId: user.id,
      category: { not: "REBF" },
      status: { in: ["DRAFT", "ACTION_REQUIRED"] },
    },
    select: {
      id: true,
      type: true,
      category: true,
      status: true,
      data: true,
      unlockedDocuments: true,
      referenceNo: true,
    },
  });
  for (const app of open) await syncProfileDocuments(app, user, ctx);
}

/**
 * Applicants' current profile photos for staff lists (UX-035): user id → the URL of the staff
 * photo route, one query for a whole page. Users without a photo are absent (initials show).
 */
export async function applicantPhotoUrls(userIds: readonly string[]) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map<string, string>();
  const photos = await db.profileDocument.findMany({
    where: {
      userId: { in: ids },
      type: "photo",
      removedAt: null,
      status: { notIn: ["INFECTED", "REJECTED_FILE"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true },
  });
  const urls = new Map<string, string>();
  for (const p of photos)
    if (!urls.has(p.userId))
      urls.set(p.userId, `/api/backoffice/applicants/${p.userId}/photo?v=${p.id}`);
  return urls;
}

/** The applicant's current profile photo for staff (UX-035); access is checked by the route. */
export async function readApplicantPhoto(userId: string) {
  const doc = await db.profileDocument.findFirst({
    where: {
      userId,
      type: "photo",
      removedAt: null,
      status: { notIn: ["INFECTED", "REJECTED_FILE"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!doc) throw new AppError("notFound");
  return {
    bytes: await blobStore.get(doc.storageKey),
    mimeType: doc.mimeType,
    fileName: doc.fileName,
  };
}
