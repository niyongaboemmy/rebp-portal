import type { ApplicationType, Category } from "./categories";
import type { SectionKey } from "./application";
import { EXAM_CATEGORIES, REQUIRED_TRAINING, type ApplicationData } from "./sections";

/**
 * Dynamic document checklist (SRS Appendix B, FR-I-001…004). Derived from category, application
 * type, applicant type and conditional answers, e.g. a foreign qualification adds recognition
 * evidence. Proof of payment is satisfied automatically by the payment record (FR-I-004).
 */
export const DOCUMENT_TYPES = [
  "proofOfIdentity",
  "photo",
  "educationCertificate",
  "transcript",
  "foreignRecognition",
  "trainingCertificate",
  "examResult",
  "experienceEvidence",
  "equivalenceDecision",
  "criminalRecord",
  "integrityDisclosure",
  "affiliationEvidence",
  "referralApproval",
  "independentAuthorisation",
  "previousLicence",
  "appointmentLetter",
  "designationProof",
  "managementTraining",
  "indemnityInsurance",
  "companyRegistration",
  "fullRegistrationInfo",
  "taxRegistration",
  "businessAddressProof",
  "supervisorySystems",
  "clientFunds",
  "directorsIdentity",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Identity documents kept on the applicant's profile (UX-010): uploaded once and copied into
 * every application, like the personal details they prove.
 */
export const PROFILE_DOCUMENT_TYPES: readonly DocumentType[] = ["proofOfIdentity", "photo"];

/**
 * The CV's evidence (UX-018): certificates and letters that prove the education, training and
 * experience on the applicant's CV. Kept on the profile and copied into each application that
 * needs them; unlike the identity documents they don't count toward the profile's completion.
 */
export const CV_DOCUMENT_TYPES: readonly DocumentType[] = [
  "educationCertificate",
  "transcript",
  "foreignRecognition",
  "trainingCertificate",
  "examResult",
  "experienceEvidence",
  "equivalenceDecision",
  "previousLicence",
];

/** Every document type the profile can hold. */
export const PROFILE_STORED_DOCUMENT_TYPES: readonly DocumentType[] = [
  ...PROFILE_DOCUMENT_TYPES,
  ...CV_DOCUMENT_TYPES,
];

export type MimeType = "application/pdf" | "image/jpeg" | "image/png";
const PDF_AND_IMAGES: readonly MimeType[] = ["application/pdf", "image/jpeg", "image/png"];
const IMAGES: readonly MimeType[] = ["image/jpeg", "image/png"];

export const MB = 1024 * 1024;

export interface DocumentRule {
  accept: readonly MimeType[];
  maxBytes: number;
  maxFiles: number;
  /** The wizard step whose page shows the upload slot. */
  step: SectionKey | "i";
  /** Sensitive classification (FR-H-006): views are logged and restricted. */
  sensitive?: boolean;
  /** Tracked expiry (FR-DOC-011). */
  expires?: boolean;
}

/** FR-DOC-001/002 defaults: PDF/JPEG/PNG, 5 MB per file, photographs 2 MB. */
export const DOCUMENT_RULES: Record<DocumentType, DocumentRule> = {
  proofOfIdentity: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "b" },
  photo: { accept: IMAGES, maxBytes: 2 * MB, maxFiles: 1, step: "b" },
  educationCertificate: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 5, step: "c" },
  transcript: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 5, step: "c" },
  foreignRecognition: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 3, step: "c" },
  trainingCertificate: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 3, step: "d" },
  examResult: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "d" },
  experienceEvidence: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 10, step: "e" },
  equivalenceDecision: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "e" },
  criminalRecord: {
    accept: PDF_AND_IMAGES,
    maxBytes: 5 * MB,
    maxFiles: 1,
    step: "h",
    sensitive: true,
    expires: true,
  },
  integrityDisclosure: {
    accept: PDF_AND_IMAGES,
    maxBytes: 5 * MB,
    maxFiles: 5,
    step: "h",
    sensitive: true,
  },
  affiliationEvidence: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 3, step: "f" },
  referralApproval: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "f" },
  independentAuthorisation: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "f" },
  previousLicence: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "e" },
  appointmentLetter: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "g" },
  designationProof: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "g" },
  managementTraining: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "g" },
  indemnityInsurance: {
    accept: PDF_AND_IMAGES,
    maxBytes: 5 * MB,
    maxFiles: 2,
    step: "g",
    expires: true,
  },
  companyRegistration: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "g" },
  fullRegistrationInfo: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "g" },
  taxRegistration: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "g" },
  businessAddressProof: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 2, step: "g" },
  supervisorySystems: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 3, step: "g" },
  clientFunds: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 3, step: "g" },
  directorsIdentity: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 10, step: "g" },
  other: { accept: PDF_AND_IMAGES, maxBytes: 5 * MB, maxFiles: 5, step: "i" },
};

export interface ChecklistItem {
  type: DocumentType;
  /** M = mandatory; C = conditional (the reason is `condition`). */
  requirement: "M" | "C";
  /** i18n key suffix explaining why a conditional item applies. */
  condition?: string;
}

export interface ChecklistContext {
  type: ApplicationType;
  category: Category;
  data: ApplicationData;
  /** Officer-added named requirements (FR-I-005). */
  extra?: readonly string[];
}

/** The documents this application needs, in display order. */
export function buildChecklist({ type, category, data }: ChecklistContext): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const m = (t: DocumentType) => items.push({ type: t, requirement: "M" });
  const c = (t: DocumentType, condition: string) =>
    items.push({ type: t, requirement: "C", condition });
  const individual = category !== "REBF";

  if (type === "RENEWAL") {
    // FR-REN-001: renewal asks only for what changes or expires.
    if (individual) m("photo");
    m("criminalRecord");
    if (anyDisclosure(data)) c("integrityDisclosure", "disclosure");
    if (category === "PRINCIPAL_BROKER" || category === "REBF")
      c("indemnityInsurance", "indemnity");
    return items;
  }

  if (individual) {
    m("proofOfIdentity");
    m("photo");
  }

  const quals = data.c?.qualifications ?? [];
  if (["RERA", "FSLA", "REA", "BROKER"].includes(category)) {
    m("educationCertificate");
    if (category === "BROKER") c("transcript", "fieldCheck");
    if (quals.some((q) => q.isForeign)) c("foreignRecognition", "foreign");
  }

  if (REQUIRED_TRAINING[category]) m("trainingCertificate");
  if (EXAM_CATEGORIES.includes(category)) m("examResult");
  if (category === "REA" || category === "BROKER") {
    m("experienceEvidence");
    if (data.e?.equivalentRecognised) c("equivalenceDecision", "equivalence");
    // FR-E-002: a licence already on the register (an upgrade's own licence) is linked, not uploaded.
    if (data.e?.previousLicenceNo && type !== "UPGRADE") c("previousLicence", "previousLicence");
  }

  if (category === "REBF") {
    m("companyRegistration");
    m("fullRegistrationInfo");
    m("businessAddressProof");
    m("supervisorySystems");
    m("directorsIdentity");
    if (data.g?.tin) c("taxRegistration", "tin");
    if (data.g?.clientFundsApplicable) c("clientFunds", "clientFunds");
    c("indemnityInsurance", "indemnity");
  }

  m("criminalRecord");
  if (anyDisclosure(data)) c("integrityDisclosure", "disclosure");

  switch (category) {
    case "RERA":
      if (data.f?.reraMode === "REFERRAL") c("referralApproval", "referral");
      else m("affiliationEvidence");
      break;
    case "FSLA":
    case "REA":
    case "ASSOCIATE_BROKER":
      m("affiliationEvidence");
      break;
    case "BROKER":
      if (data.f?.practiceArrangement === "AFFILIATED") c("affiliationEvidence", "affiliated");
      if (data.f?.practiceArrangement === "INDEPENDENT")
        c("independentAuthorisation", "independent");
      break;
    case "MANAGING_BROKER":
      m("appointmentLetter");
      c("managementTraining", "management");
      break;
    case "PRINCIPAL_BROKER":
      m("designationProof");
      c("indemnityInsurance", "indemnity");
      break;
  }
  return items;
}

function anyDisclosure(data: ApplicationData): boolean {
  const h = data.h ?? {};
  return Boolean(
    h.criminalConviction || h.disciplinarySanction || h.licenceRevoked || h.currentRestriction,
  );
}

/** Conditional items that the submission gate still treats as required once their condition holds. */
export function isRequiredForSubmission(item: ChecklistItem): boolean {
  // "management" is "where applicable" (G6.7) and stays advisory; every other triggered item is required.
  return item.requirement === "M" || item.condition !== "management";
}

export const DOCUMENT_STATUSES = [
  "SCANNING",
  "CLEAN",
  "INFECTED",
  "REJECTED_FILE",
  "VERIFIED",
  "REJECTED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Checklist item status for the applicant (FR-I-003). */
export type ChecklistStatus =
  "missing" | "uploaded" | "scanning" | "rejectedScan" | "verified" | "rejected";

export function checklistStatus(statuses: readonly DocumentStatus[]): ChecklistStatus {
  if (statuses.length === 0) return "missing";
  if (statuses.includes("REJECTED")) return "rejected";
  if (statuses.includes("VERIFIED") && statuses.every((s) => s === "VERIFIED")) return "verified";
  if (statuses.includes("SCANNING")) return "scanning";
  if (statuses.every((s) => s === "INFECTED" || s === "REJECTED_FILE")) return "rejectedScan";
  return "uploaded";
}

/** An item counts as provided when at least one current file is clean or verified. */
export function isSatisfied(statuses: readonly DocumentStatus[]): boolean {
  return statuses.some((s) => s === "CLEAN" || s === "VERIFIED");
}
