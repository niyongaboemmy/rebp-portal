import "server-only";
import { randomBytes } from "node:crypto";
import {
  buildChecklist,
  DOCUMENT_RULES,
  DOCUMENT_TYPES,
  type DocumentStatus,
  type DocumentType,
} from "@rebp/contracts";
import type { Application, User } from "@/generated/prisma/client";
import { userCan } from "../access/permissions";
import { asData } from "../applications/applications";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { blobStore, sha256Hex } from "../storage/blob-store";
import { extensionMatches, imageSize, inspectPdf, malwareScanner, sniffMime } from "./scan";

/**
 * Documents (WP-1.9, FR-DOC-001…008, FR-I-001…005). Uploads are validated (type, size, magic bytes,
 * extension, PDF active content), scanned, encrypted at rest and versioned. Only current versions
 * count towards the checklist. Reads are authorised per request.
 */

export interface UploadInput {
  applicationId: string;
  type: string;
  /** Replace this document with a new version (FR-DOC-007). */
  replaceId?: string;
  fileName: string;
  bytes: Buffer;
}

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Document types the applicant may add or replace right now (FR-WF-002, FR-I-005). */
export function uploadableTypes(
  app: Pick<
    Application,
    "status" | "type" | "category" | "data" | "unlockedDocuments" | "extraDocuments"
  >,
): Set<DocumentType> {
  const checklist = buildChecklist({
    type: app.type,
    category: app.category,
    data: asData(app.data),
  });
  const types = new Set<DocumentType>(checklist.map((item) => item.type));
  if (app.extraDocuments.length > 0) types.add("other");
  if (app.status === "DRAFT") return types;
  if (app.status === "ACTION_REQUIRED") {
    const unlocked = new Set(app.unlockedDocuments.filter(isDocumentType));
    if (app.extraDocuments.length > 0) unlocked.add("other");
    return unlocked;
  }
  return new Set();
}

export function storageKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(
    18,
  )
    .toString("base64url")
    .replace(/[^a-z0-9]/gi, "x")}`;
}

/** Cleans a client file name for display and download headers. */
export function cleanName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "document";
}

/**
 * The checks every upload passes (FR-DOC-002…005): size, magic bytes, extension, PDF active
 * content, photo dimensions and a malware scan. Shared by application and profile uploads.
 */
export async function inspectUpload(type: DocumentType, bytes: Buffer, fileName: string) {
  const rule = DOCUMENT_RULES[type];
  if (bytes.length === 0) throw new AppError("fileEmpty");
  if (bytes.length > rule.maxBytes)
    throw new AppError("fileTooLarge", "errors.fileTooLarge", undefined, {
      maxMb: rule.maxBytes / 1024 / 1024,
    });

  const mime = sniffMime(bytes);
  if (!mime || !rule.accept.includes(mime)) throw new AppError("fileTypeInvalid");
  if (!extensionMatches(fileName, mime)) throw new AppError("fileExtensionMismatch");

  let status: DocumentStatus = "CLEAN";
  let scanDetail: string | null = null;
  if (mime === "application/pdf") {
    const verdict = inspectPdf(bytes);
    if (verdict !== "ok") {
      status = "REJECTED_FILE";
      scanDetail = verdict;
    }
  }
  if (type === "photo") {
    const size = imageSize(bytes, mime);
    if (!size || size.width < 600 || size.height < 600) throw new AppError("photoTooSmall");
  }
  const scan = await malwareScanner.scan(bytes);
  if (!scan.clean) {
    status = "INFECTED";
    scanDetail = scan.signature ?? "malware";
  }
  return { mime, status, scanDetail };
}

export async function uploadDocument(input: UploadInput, user: User, ctx: RequestContext) {
  const app = await db.application.findUnique({ where: { id: input.applicationId } });
  if (!app || app.applicantId !== user.id) throw new AppError("notFound");
  if (!isDocumentType(input.type)) throw new AppError("documentTypeInvalid");
  if (!uploadableTypes(app).has(input.type)) throw new AppError("sectionLocked");

  const { mime, status, scanDetail } = await inspectUpload(input.type, input.bytes, input.fileName);
  const rule = DOCUMENT_RULES[input.type];

  const replacing = input.replaceId
    ? await db.document.findFirst({
        where: { id: input.replaceId, applicationId: app.id, type: input.type, removedAt: null },
      })
    : null;
  if (input.replaceId && !replacing) throw new AppError("notFound");
  if (!replacing) {
    // Files that failed the security check don't use up the allowance.
    const count = await db.document.count({
      where: {
        applicationId: app.id,
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

  const document = await db.$transaction(async (tx) => {
    const doc =
      replacing ??
      (await tx.document.create({
        data: {
          applicationId: app.id,
          type: input.type,
          ownerId: user.id,
          status,
          currentVersion: 0,
        },
      }));
    const version = doc.currentVersion + 1;
    await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        version,
        fileName,
        mimeType: mime,
        size: input.bytes.length,
        sha256,
        storageKey: status === "INFECTED" ? `quarantine/${key}` : key,
        scanStatus: status,
        scanDetail,
        uploadedById: user.id,
      },
    });
    return tx.document.update({
      where: { id: doc.id },
      data: {
        currentVersion: version,
        status,
        officerNote: null,
        verifiedById: null,
        verifiedAt: null,
      },
    });
  });

  await recordAudit({
    action:
      status === "INFECTED"
        ? "document.quarantined"
        : replacing
          ? "document.replaced"
          : "document.uploaded",
    entityType: "Document",
    entityId: document.id,
    actorId: user.id,
    metadata: {
      reference: app.referenceNo,
      type: input.type,
      version: document.currentVersion,
      status,
      sha256,
    },
    ...ctx,
  });
  await db.application.update({ where: { id: app.id }, data: { lastActivityAt: new Date() } });
  return {
    id: document.id,
    status,
    version: document.currentVersion,
    fileName,
    size: input.bytes.length,
    mimeType: mime,
  };
}

export async function removeDocument(documentId: string, user: User, ctx: RequestContext) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { application: true },
  });
  if (!doc || doc.ownerId !== user.id || doc.removedAt) throw new AppError("notFound");
  if (!uploadableTypes(doc.application).has(doc.type as DocumentType))
    throw new AppError("sectionLocked");
  await db.document.update({ where: { id: doc.id }, data: { removedAt: new Date() } });
  await recordAudit({
    action: "document.removed",
    entityType: "Document",
    entityId: doc.id,
    actorId: user.id,
    metadata: { reference: doc.application.referenceNo, type: doc.type },
    ...ctx,
  });
}

/**
 * Authorised read (FR-DOC-008). Owners read their own files; staff with review or decision access
 * read any; supervisors and Principal Brokers read nothing (they see a summary only, App. D).
 * Sensitive types (Section H) log every view (FR-H-006).
 */
export async function readDocument(
  documentId: string,
  viewer: User,
  ctx: RequestContext,
  { version, download = false }: { version?: number; download?: boolean } = {},
) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: {
      application: { select: { id: true, referenceNo: true, applicantId: true } },
      versions: true,
    },
  });
  if (!doc) throw new AppError("notFound");
  const isOwner = doc.application.applicantId === viewer.id;
  const isStaff =
    !isOwner &&
    ((await userCan(viewer, "review.view")) ||
      (await userCan(viewer, "decision.view")) ||
      (await userCan(viewer, "review.perform")));
  if (!isOwner && !isStaff) throw new AppError("notFound");

  const target = doc.versions.find((v) => v.version === (version ?? doc.currentVersion));
  // Files that failed the security check (malware, active content) are never served (M4).
  if (!target || target.scanStatus === "INFECTED" || target.scanStatus === "REJECTED_FILE")
    throw new AppError("notFound");
  const bytes = await blobStore.get(target.storageKey);

  const rule = isDocumentType(doc.type) ? DOCUMENT_RULES[doc.type] : undefined;
  if (isStaff || rule?.sensitive) {
    await recordAudit({
      action: download ? "document.downloaded" : "document.viewed",
      entityType: "Document",
      entityId: doc.id,
      actorId: viewer.id,
      metadata: { reference: doc.application.referenceNo, type: doc.type, version: target.version },
      ...ctx,
    });
  }
  return { bytes, mimeType: target.mimeType, fileName: target.fileName, isStaff };
}

/** FR-L-011: an officer marks a document verified or rejected (with a reason). */
export async function setDocumentVerdict(
  documentId: string,
  verdict: "VERIFIED" | "REJECTED",
  reason: string | undefined,
  officer: User,
  ctx: RequestContext,
) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { application: true },
  });
  if (!doc || doc.removedAt) throw new AppError("notFound");
  if (doc.status === "INFECTED" || doc.status === "REJECTED_FILE")
    throw new AppError("documentNotReviewable");
  // M2: only the assigned, conflict-free officer, and only while the file is under review.
  if (!["SUBMITTED", "UNDER_REVIEW", "FURTHER_ASSESSMENT"].includes(doc.application.status))
    throw new AppError("invalidTransition");
  const { assertReviewer } = await import("../backoffice/review");
  await assertReviewer(doc.application, officer);
  if (verdict === "REJECTED" && (!reason || reason.trim().length < 5))
    throw new AppError("reasonRequired");
  await db.document.update({
    where: { id: doc.id },
    data: {
      status: verdict,
      officerNote: reason ?? null,
      verifiedById: officer.id,
      verifiedAt: new Date(),
    },
  });
  await recordAudit({
    action: verdict === "VERIFIED" ? "document.verified" : "document.rejected",
    entityType: "Document",
    entityId: doc.id,
    actorId: officer.id,
    metadata: { reference: doc.application.referenceNo, type: doc.type },
    ...ctx,
  });
}
