import "server-only";
import { createTranslator } from "next-intl";
import type { DecisionCondition, FeeLine } from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import { loadMessages, resolveLocale } from "@/i18n/messages";
import { userCan } from "../access/permissions";
import { db } from "../db";
import { env } from "../env";
import { AppError } from "../errors";
import { certificatePdf, sealOf, simpleDocumentPdf } from "../pdf/pdf";
import { blobStore } from "../storage/blob-store";
import { dayOf } from "../time";

/**
 * Downloadable official documents (FR-PORTAL-003): licence certificate (FR-N-002), payment receipt
 * (FR-PAY-007), acknowledgment of receipt (FR-WIZ-014) and decision letter (FR-M-015). Owners and
 * back-office staff may download; everyone else gets "not found".
 */
type T = (key: string, values?: Record<string, string | number>) => string;

function translator(locale: string | null | undefined): T {
  const resolved = resolveLocale(locale);
  return createTranslator({ locale: resolved, messages: loadMessages(resolved) }) as unknown as T;
}

async function isStaffReader(user: User) {
  return (
    (await userCan(user, "review.view")) ||
    (await userCan(user, "payments.view")) ||
    (await userCan(user, "decision.view"))
  );
}

const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString("en-US")}`;

export function verifyUrl(qrToken: string) {
  return `${env().APP_URL}/check/${qrToken}`;
}

/** The certificate payload sealed on the PDF and shown on the verification page. */
export function certificateSeal(licence: {
  licenceNo: string;
  displayName: string;
  category: string;
  issuedAt: Date;
  expiresAt: Date;
  certificateVersion: number;
  qrToken: string;
}) {
  return sealOf({
    licenceNo: licence.licenceNo,
    holder: licence.displayName,
    category: licence.category,
    issuedAt: dayOf(licence.issuedAt),
    expiresAt: dayOf(licence.expiresAt),
    version: licence.certificateVersion,
    token: licence.qrToken,
  });
}

export async function certificateFor(licenceId: string, viewer: User) {
  const licence = await db.licence.findUnique({
    where: { id: licenceId },
    include: { registrant: true, affiliatedFirm: true, firm: true },
  });
  if (!licence || (licence.holderId !== viewer.id && !(await isStaffReader(viewer))))
    throw new AppError("notFound");
  const t = translator(viewer.locale);
  const supervisor = licence.supervisorLicenceId
    ? await db.licence.findUnique({
        where: { id: licence.supervisorLicenceId },
        select: { displayName: true, licenceNo: true },
      })
    : null;
  const scopeNames = licence.scope.length
    ? (
        await db.adminDivision.findMany({
          where: { code: { in: licence.scope } },
          select: { name: true },
        })
      ).map((d) => d.name)
    : [];
  let photo: { bytes: Buffer; mimeType: string } | null = null;
  if (licence.photoVersionId) {
    const version = await db.documentVersion.findUnique({ where: { id: licence.photoVersionId } });
    if (version)
      photo = { bytes: await blobStore.get(version.storageKey), mimeType: version.mimeType };
  }
  const conditions = ((licence.conditions as unknown as DecisionCondition[]) ?? []).map((c) =>
    c.code === "CUSTOM"
      ? (c.text ?? "")
      : `${t(`conditions.${c.code}`)}${c.text ? ` - ${c.text}` : ""}`,
  );
  if (licence.category === "RERA") conditions.unshift(t("licence.referralOnly"));
  const bytes = await certificatePdf({
    holder: licence.displayName,
    registrationNo: licence.registrant.registrationNo,
    licenceNo: licence.licenceNo,
    categoryName: t(`categories.items.${licence.category}.name`),
    status: t(`status.licence.${licence.status}`),
    scope: scopeNames.length ? scopeNames.join(", ") : t("licence.nationwide"),
    arrangement: t(`arrangements.${licence.practiceArrangement ?? "AFFILIATED"}`),
    firm: (licence.firm ?? licence.affiliatedFirm)?.legalName ?? null,
    supervisor: supervisor ? `${supervisor.displayName} (${supervisor.licenceNo})` : null,
    issuedOn: dayOf(licence.issuedAt),
    expiresOn: dayOf(licence.expiresAt),
    conditions,
    verifyUrl: verifyUrl(licence.qrToken),
    certificateVersion: licence.certificateVersion,
    photo,
    seal: certificateSeal(licence),
  });
  return { bytes, fileName: `${licence.licenceNo}-certificate.pdf` };
}

export async function receiptFor(paymentId: string, viewer: User) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { application: { select: { referenceNo: true, applicantId: true, category: true } } },
  });
  if (!payment || (!payment.receiptNo && payment.status !== "WAIVED"))
    throw new AppError("notFound");
  if (
    payment.payerId !== viewer.id &&
    payment.application.applicantId !== viewer.id &&
    !(await isStaffReader(viewer))
  )
    throw new AppError("notFound");
  const t = translator(viewer.locale);
  const payer = await db.user.findUniqueOrThrow({
    where: { id: payment.payerId },
    select: { fullName: true },
  });
  const lines = (payment.lines as unknown as FeeLine[]) ?? [];
  const bytes = await simpleDocumentPdf({
    title: payment.status === "WAIVED" ? t("documents.waiverTitle") : t("documents.receiptTitle"),
    subtitle: `${payment.receiptNo ?? payment.reference}`,
    entries: [
      [t("documents.payer"), payer.fullName],
      [t("documents.application"), payment.application.referenceNo],
      [t("documents.paymentReference"), payment.reference],
      [t("documents.method"), t(`payment.methods.${payment.method ?? "CARD"}`)],
      [t("documents.transaction"), payment.providerTxnId ?? "-"],
      [
        t("documents.paidAt"),
        payment.paidAt?.toISOString().replace("T", " ").slice(0, 16) + " UTC",
      ],
    ],
    table: {
      head: [t("documents.item"), t("documents.amount")],
      rows: lines.map((l) => [t(`payment.lines.${l.code}`), money(l.amount, payment.currency)]),
      total: [t("documents.total"), money(payment.amount, payment.currency)],
    },
    paragraphs:
      payment.status === "WAIVED"
        ? [t("documents.waiverNote", { reason: payment.waiverReason ?? "" })]
        : [],
    footerText: t("documents.receiptFooter"),
  });
  return { bytes, fileName: `${payment.receiptNo ?? payment.reference}.pdf` };
}

export async function acknowledgmentFor(applicationId: string, viewer: User) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      snapshots: { orderBy: { version: "desc" }, take: 1 },
      applicant: { select: { fullName: true } },
    },
  });
  if (!app || !app.submittedAt || (app.applicantId !== viewer.id && !(await isStaffReader(viewer))))
    throw new AppError("notFound");
  const t = translator(viewer.locale);
  const snapshot = app.snapshots[0];
  const bytes = await simpleDocumentPdf({
    title: t("documents.ackTitle"),
    subtitle: app.referenceNo,
    entries: [
      [t("documents.applicant"), app.applicant.fullName],
      [t("documents.application"), app.referenceNo],
      [t("documents.category"), t(`categories.items.${app.category}.name`)],
      [t("documents.type"), t(`applicationTypes.${app.type}.name`)],
      [
        t("documents.submittedAt"),
        `${app.submittedAt.toISOString().replace("T", " ").slice(0, 16)} UTC`,
      ],
      [t("documents.snapshotHash"), snapshot ? `${snapshot.hash.slice(0, 32)}…` : "-"],
    ],
    paragraphs: [t("documents.ackBody"), t("documents.ackNext")],
    footerText: t("documents.ackFooter"),
  });
  return { bytes, fileName: `${app.referenceNo}-acknowledgment.pdf` };
}

export async function decisionLetterFor(decisionId: string, viewer: User) {
  const decision = await db.decision.findUnique({
    where: { id: decisionId },
    include: {
      application: { include: { applicant: { select: { fullName: true } } } },
      approver: { select: { fullName: true } },
    },
  });
  if (
    !decision ||
    (decision.application.applicantId !== viewer.id && !(await isStaffReader(viewer)))
  )
    throw new AppError("notFound");
  const t = translator(viewer.locale);
  const app = decision.application;
  const conditions = ((decision.conditions as unknown as DecisionCondition[]) ?? []).map((c) =>
    c.code === "CUSTOM"
      ? (c.text ?? "")
      : `${t(`conditions.${c.code}`)}${c.text ? ` - ${c.text}` : ""}`,
  );
  const paragraphs = [
    t(`documents.letter.${decision.decision}`, {
      category: t(`categories.items.${app.category}.name`),
    }),
  ];
  if (conditions.length) paragraphs.push(`${t("documents.conditions")}: ${conditions.join("; ")}`);
  if (decision.reasons) paragraphs.push(`${t("documents.reasons")}: ${decision.reasons}`);
  if (decision.decision === "REJECTED") paragraphs.push(t("documents.letter.appeal"));
  const bytes = await simpleDocumentPdf({
    title: t("documents.letterTitle"),
    subtitle: decision.letterNo,
    entries: [
      [t("documents.applicant"), app.applicant.fullName],
      [t("documents.application"), app.referenceNo],
      [t("documents.decision"), t(`decision.types.${decision.decision}`)],
      [t("documents.decidedAt"), dayOf(decision.signedAt)],
      [t("documents.approver"), `${decision.approver.fullName}, ${t("roles.APPROVING_AUTHORITY")}`],
    ],
    paragraphs,
    footerText: t("documents.letterFooter"),
  });
  return { bytes, fileName: `${decision.letterNo}.pdf` };
}
