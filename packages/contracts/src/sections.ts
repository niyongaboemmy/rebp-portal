import { z } from "zod";
import { normalisePhone } from "./auth";
import { CATEGORIES, type ApplicationType, type Category } from "./categories";
import { AFFILIATED_CATEGORIES, SUPERVISED_CATEGORIES, type SectionKey } from "./application";

/**
 * Form REBP–REG–01 sections B–H and J (SRS Appendix A). Each section has:
 *  - a lenient *draft* schema: every field optional, types and lengths enforced, so autosave
 *    (FR-WIZ-004) can store partial input safely;
 *  - a *completeness* check returning `path → i18n key` for every missing or invalid field.
 * The same check drives step status (FR-WIZ-005), inline errors (FR-WIZ-006) and the
 * submission gate (FR-WIZ-013), on the client and the server.
 */

// ---------------------------------------------------------------------------
// Reference lists
// ---------------------------------------------------------------------------

export const ID_TYPES = ["NATIONAL_ID", "PASSPORT", "REFUGEE_ID", "OTHER"] as const;
export const GENDERS = ["FEMALE", "MALE", "UNDISCLOSED"] as const;
export const EDUCATION_LEVELS_C = [
  "A2",
  "A1",
  "A0",
  "BACHELOR",
  "POSTGRADUATE",
  "OTHER_RECOGNISED",
] as const;
export type EducationLevelC = (typeof EDUCATION_LEVELS_C)[number];

export const FIELDS_OF_STUDY = [
  "REAL_ESTATE",
  "ESTATE_MANAGEMENT_VALUATION",
  "VALUATION_PROPERTY_MANAGEMENT",
  "BUSINESS",
  "ECONOMICS",
  "FINANCE",
  "ACCOUNTING",
  "MARKETING",
  "LAW",
  "CIVIL_ENGINEERING",
  "ARCHITECTURE",
  "URBAN_PLANNING",
  "LAND_SURVEYING",
  "GENERAL_SECONDARY",
  "OTHER",
] as const;
export type FieldOfStudy = (typeof FIELDS_OF_STUDY)[number];

/** Accredited training providers and their programmes (FR-D-002; sample data until P-inputs). */
export const TRAINING_PROGRAMME_TYPES = [
  "ENTRY",
  "PROFESSIONAL",
  "ADVANCED_BROKER",
  "MANAGEMENT",
] as const;
export type TrainingProgrammeType = (typeof TRAINING_PROGRAMME_TYPES)[number];

export const TRAINING_PROVIDERS = [
  { code: "PBTI", programmes: ["ENTRY", "PROFESSIONAL", "ADVANCED_BROKER", "MANAGEMENT"] },
  { code: "KSRE", programmes: ["ENTRY", "PROFESSIONAL"] },
  { code: "EAPA", programmes: ["PROFESSIONAL", "ADVANCED_BROKER", "MANAGEMENT"] },
] as const satisfies ReadonlyArray<{ code: string; programmes: readonly TrainingProgrammeType[] }>;
export const TRAINING_PROVIDER_CODES = [...TRAINING_PROVIDERS.map((p) => p.code), "OTHER"] as const;

/** FR-D-008: the training each category requires. */
export const REQUIRED_TRAINING: Partial<Record<Category, TrainingProgrammeType>> = {
  FSLA: "ENTRY",
  REA: "PROFESSIONAL",
  BROKER: "ADVANCED_BROKER",
};
/** FR-D-003: categories with a licensing examination. */
export const EXAM_CATEGORIES: readonly Category[] = ["REA", "BROKER"];

export const EXAM_ANSWERS = ["YES", "NO", "NOT_APPLICABLE"] as const;
export const EXPERIENCE_CATEGORIES = ["RERA", "FSLA", "REA", "BROKER", "EQUIVALENT"] as const;
export const RERA_MODES = ["FIRM", "REFERRAL"] as const;
export const PRACTICE_ARRANGEMENTS = [
  "AFFILIATED",
  "INDEPENDENT",
  "ESTABLISH_OR_JOIN_REBF",
] as const;
export type PracticeArrangement = (typeof PRACTICE_ARRANGEMENTS)[number];
export const LEGAL_FORMS = [
  "PRIVATE_LIMITED",
  "PUBLIC_COMPANY",
  "PARTNERSHIP",
  "SOLE_PROPRIETORSHIP",
  "COOPERATIVE",
  "OTHER",
] as const;
export const SUPERVISORY_FUNCTIONS = [
  "TRANSACTIONS",
  "TRAINING",
  "COMPLIANCE",
  "CLIENT_FUNDS",
  "COMPLAINTS",
] as const;
export const INTEGRITY_QUESTIONS = [
  "criminalConviction",
  "disciplinarySanction",
  "licenceRevoked",
  "currentRestriction",
] as const;
export type IntegrityQuestion = (typeof INTEGRITY_QUESTIONS)[number];
export const PRINCIPAL_RESPONSIBILITIES = [
  "supervision",
  "clientFunds",
  "records",
  "compliance",
  "complaints",
] as const;

/** Versions of acknowledgment texts recorded with the answers (FR-G1-005, FR-H-004, FR-J-001). */
export const TEXT_VERSIONS = {
  article10: "ART10-2026.1",
  fslaRestrictions: "FSLA-RESTR-2026.1",
  principalSupervision: "PB-SUP-2026.1",
  principalResponsibilities: "PB-RESP-2026.1",
  codeOfConduct: "CODE-2026.1",
  declaration: "DECL-2026.1",
  privacyNotice: "PRIVACY-2026.1",
} as const;

export const DECLARATION_STATEMENTS = 8;

// ---------------------------------------------------------------------------
// Draft schemas
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max, "validation.tooLong");
const optText = (max: number) => text(max).optional();
const date = z.union([z.iso.date(), z.literal("")]).optional();
const bool = z.boolean().optional();
const clientId = z.string().max(40);

export const addressSchema = z
  .object({
    province: optText(20),
    district: optText(20),
    sector: optText(20),
    cell: optText(20),
    village: optText(20),
    details: optText(200),
    abroad: bool,
    abroadText: optText(300),
  })
  .partial();
export type Address = z.infer<typeof addressSchema>;

export const sectionBSchema = z
  .object({
    surname: optText(100),
    givenNames: optText(100),
    otherNames: optText(100),
    fullNameOnId: optText(200),
    idType: z.enum(ID_TYPES).optional(),
    idNumber: optText(30),
    idCountry: optText(2),
    idExpiry: date,
    dateOfBirth: date,
    nationality: z.array(z.string().length(2)).max(3).optional(),
    gender: z.enum(GENDERS).optional(),
    phone: optText(20),
    email: optText(254),
    residentialAddress: addressSchema.optional(),
    professionalSameAsResidential: bool,
    professionalAddress: addressSchema.optional(),
    occupation: optText(100),
    employer: optText(150),
  })
  .partial();
export type SectionB = z.infer<typeof sectionBSchema>;

export const qualificationSchema = z
  .object({
    id: clientId,
    institution: optText(200),
    qualification: optText(200),
    fieldOfStudy: z.enum(FIELDS_OF_STUDY).optional(),
    fieldOther: optText(120),
    yearCompleted: z.number().int().min(1900).max(2100).optional(),
    certificateNo: optText(60),
    isForeign: bool,
    reliedUpon: bool,
  })
  .partial()
  .required({ id: true });
export type Qualification = z.infer<typeof qualificationSchema>;

export const sectionCSchema = z
  .object({
    highestLevel: z.enum(EDUCATION_LEVELS_C).optional(),
    qualifications: z.array(qualificationSchema).max(10).optional(),
  })
  .partial();
export type SectionC = z.infer<typeof sectionCSchema>;

export const sectionDSchema = z
  .object({
    trainingCompleted: bool,
    trainingProvider: z.enum(TRAINING_PROVIDER_CODES).optional(),
    trainingProviderOther: optText(200),
    trainingProgramme: z.enum(TRAINING_PROGRAMME_TYPES).optional(),
    trainingCompletedOn: date,
    trainingCertificateNo: optText(60),
    examPassed: z.enum(EXAM_ANSWERS).optional(),
    examReference: optText(60),
    examDate: date,
  })
  .partial();
export type SectionD = z.infer<typeof sectionDSchema>;

export const experienceRecordSchema = z
  .object({
    id: clientId,
    firm: optText(200),
    firmId: z.uuid().optional(),
    category: z.enum(EXPERIENCE_CATEGORIES).optional(),
    from: date,
    to: date,
    current: bool,
    duties: optText(2000),
  })
  .partial()
  .required({ id: true });
export type ExperienceRecord = z.infer<typeof experienceRecordSchema>;

export const sectionESchema = z
  .object({
    currentCategory: z.enum(CATEGORIES).optional(),
    previousLicenceNo: optText(40),
    records: z.array(experienceRecordSchema).max(20).optional(),
    declaredYears: z.number().min(0).max(70).optional(),
    refereeName: optText(120),
    refereeRole: optText(120),
    refereePhone: optText(20),
    refereeEmail: optText(254),
    priorCategoryForExperience: z.enum(EXPERIENCE_CATEGORIES).optional(),
    initialRegistrationDate: date,
    equivalentRecognised: bool,
    equivalenceReference: optText(80),
  })
  .partial();
export type SectionE = z.infer<typeof sectionESchema>;

export const sectionFSchema = z
  .object({
    practiceArrangement: z.enum(PRACTICE_ARRANGEMENTS).optional(),
    reraMode: z.enum(RERA_MODES).optional(),
    isAffiliated: bool,
    firmId: z.uuid().optional(),
    firmName: optText(200),
    branchId: z.uuid().optional(),
    supervisorLicenceNo: optText(40),
    affiliationStart: date,
    referralArrangementName: optText(200),
    referralApprovalRef: optText(80),
    independentAuthorisationRef: optText(80),
    independentNotes: optText(1000),
  })
  .partial();
export type SectionF = z.infer<typeof sectionFSchema>;

const indemnitySchema = z
  .object({
    insurer: optText(200),
    policyNo: optText(60),
    cover: z.number().min(0).max(1e12).optional(),
    from: date,
    to: date,
  })
  .partial();

const responsiblePersonSchema = z
  .object({
    id: clientId,
    name: optText(200),
    role: optText(80),
    idType: z.enum(ID_TYPES).optional(),
    idNumber: optText(30),
    nationality: optText(2),
    phone: optText(20),
    email: optText(254),
    shareholding: z.number().min(0).max(100).optional(),
  })
  .partial()
  .required({ id: true });

const branchSchema = z
  .object({
    id: clientId,
    name: optText(120),
    address: addressSchema.optional(),
    phone: optText(20),
    managingBrokerLicenceNo: optText(40),
    openingDate: date,
  })
  .partial()
  .required({ id: true });

export const sectionGSchema = z
  .object({
    dataConfirmed: bool,
    // G1 / G2
    article10Ack: bool,
    territory: z.array(z.string().max(20)).max(40).optional(),
    restrictionsAck: bool,
    // G5–G7
    brokerLicenceNo: optText(40),
    supervisionAck: bool,
    proposedBranchName: optText(120),
    supervisedCount: z.number().int().min(0).max(1000).optional(),
    supervisoryFunctions: z.array(z.enum(SUPERVISORY_FUNCTIONS)).max(5).optional(),
    supervisoryNotes: optText(2000),
    proposedFirmRef: optText(80),
    indemnity: indemnitySchema.optional(),
    responsibilities: z.array(z.enum(PRINCIPAL_RESPONSIBILITIES)).max(5).optional(),
    // G8
    legalName: optText(200),
    tradingName: optText(200),
    legalForm: z.enum(LEGAL_FORMS).optional(),
    companyRegNo: optText(40),
    tin: optText(20),
    incorporatedOn: date,
    registeredOffice: addressSchema.optional(),
    placeSameAsOffice: bool,
    principalPlace: addressSchema.optional(),
    phone: optText(20),
    email: optText(254),
    responsiblePersons: z.array(responsiblePersonSchema).max(20).optional(),
    principalBrokerLicenceNo: optText(40),
    branches: z.array(branchSchema).max(30).optional(),
    clientFundsApplicable: bool,
    hasSupervisoryManual: bool,
  })
  .partial();
export type SectionG = z.infer<typeof sectionGSchema>;

const disclosureSchema = z
  .object({
    id: clientId,
    question: z.enum(INTEGRITY_QUESTIONS).optional(),
    nature: optText(500),
    date: date,
    authority: optText(200),
    outcome: optText(500),
    currentStatus: optText(200),
  })
  .partial()
  .required({ id: true });

export const sectionHSchema = z
  .object({
    criminalConviction: bool,
    disciplinarySanction: bool,
    licenceRevoked: bool,
    currentRestriction: bool,
    disclosures: z.array(disclosureSchema).max(10).optional(),
    criminalRecordIssuedOn: date,
    codeOfConduct: bool,
  })
  .partial();
export type SectionH = z.infer<typeof sectionHSchema>;

export const SECTION_SCHEMAS = {
  b: sectionBSchema,
  c: sectionCSchema,
  d: sectionDSchema,
  e: sectionESchema,
  f: sectionFSchema,
  g: sectionGSchema,
  h: sectionHSchema,
} as const satisfies Record<SectionKey, z.ZodType>;

export interface ApplicationData {
  b?: SectionB;
  c?: SectionC;
  d?: SectionD;
  e?: SectionE;
  f?: SectionF;
  g?: SectionG;
  h?: SectionH;
}

export const saveSectionSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("b"), data: sectionBSchema }),
  z.object({ section: z.literal("c"), data: sectionCSchema }),
  z.object({ section: z.literal("d"), data: sectionDSchema }),
  z.object({ section: z.literal("e"), data: sectionESchema }),
  z.object({ section: z.literal("f"), data: sectionFSchema }),
  z.object({ section: z.literal("g"), data: sectionGSchema }),
  z.object({ section: z.literal("h"), data: sectionHSchema }),
]);
export type SaveSectionInput = z.infer<typeof saveSectionSchema>;

// ---------------------------------------------------------------------------
// Completeness checks
// ---------------------------------------------------------------------------

export interface SectionContext {
  type: ApplicationType;
  category: Category;
  /** Date the check runs at (YYYY-MM-DD); "today" in Africa/Kigali. */
  today: string;
  flags?: { genderField?: boolean; indemnityRequired?: boolean };
}

export type Issues = Record<string, string>;

const NAME = /^[\p{L}][\p{L}\s'’-]*$/u;
const NID = /^\d{16}$/;
const PASSPORT = /^[A-Z0-9]{6,20}$/i;
const PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const blank = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

function req(issues: Issues, path: string, value: unknown, key = "validation.required") {
  if (blank(value)) issues[path] = key;
}

function checkAddress(issues: Issues, path: string, address: Address | undefined) {
  if (address?.abroad) {
    req(issues, `${path}.abroadText`, address.abroadText);
    return;
  }
  req(issues, `${path}.province`, address?.province);
  req(issues, `${path}.district`, address?.district);
  req(issues, `${path}.sector`, address?.sector);
}

function checkPhone(issues: Issues, path: string, value: string | undefined) {
  if (blank(value)) issues[path] = "validation.required";
  else if (!PHONE.test(normalisePhone(value!))) issues[path] = "validation.phoneInvalid";
}

function checkEmail(issues: Issues, path: string, value: string | undefined) {
  if (blank(value)) issues[path] = "validation.required";
  else if (!EMAIL.test(value!)) issues[path] = "validation.emailInvalid";
}

function checkPastDate(issues: Issues, path: string, value: string | undefined, today: string) {
  if (blank(value)) issues[path] = "validation.required";
  else if (value! > today) issues[path] = "validation.dateInFuture";
}

export function checkSectionB(b: SectionB = {}, ctx: SectionContext): Issues {
  const issues: Issues = {};
  for (const key of ["surname", "givenNames"] as const) {
    if (blank(b[key])) issues[key] = "validation.required";
    else if (!NAME.test(b[key]!)) issues[key] = "validation.nameChars";
  }
  if (!blank(b.otherNames) && !NAME.test(b.otherNames!)) issues.otherNames = "validation.nameChars";
  req(issues, "idType", b.idType);
  if (blank(b.idNumber)) issues.idNumber = "validation.required";
  else if (b.idType === "NATIONAL_ID" && !NID.test(b.idNumber!))
    issues.idNumber = "validation.nationalId";
  else if (b.idType === "PASSPORT" && !PASSPORT.test(b.idNumber!))
    issues.idNumber = "validation.passport";
  if (b.idType === "PASSPORT") {
    req(issues, "idCountry", b.idCountry);
    if (blank(b.idExpiry)) issues.idExpiry = "validation.required";
    else if (b.idExpiry! <= ctx.today) issues.idExpiry = "validation.documentExpired";
  }
  checkPastDate(issues, "dateOfBirth", b.dateOfBirth, ctx.today);
  if (!b.nationality?.length) issues.nationality = "validation.required";
  if (ctx.flags?.genderField) req(issues, "gender", b.gender);
  checkPhone(issues, "phone", b.phone);
  checkEmail(issues, "email", b.email);
  checkAddress(issues, "residentialAddress", b.residentialAddress);
  if (b.professionalSameAsResidential === undefined)
    issues.professionalSameAsResidential = "validation.required";
  else if (!b.professionalSameAsResidential)
    checkAddress(issues, "professionalAddress", b.professionalAddress);
  req(issues, "occupation", b.occupation);
  return issues;
}

// ---------------------------------------------------------------------------
// Applicant profile (UX-010): Section B kept on the account, reused by every application
// ---------------------------------------------------------------------------

/** What the profile counts toward its completion rate (the answers Section B requires). */
export function profileFields(b: SectionB = {}, flags?: SectionContext["flags"]): string[] {
  const fields = [
    "surname",
    "givenNames",
    "idType",
    "idNumber",
    ...(b.idType === "PASSPORT" ? ["idCountry", "idExpiry"] : []),
    "dateOfBirth",
    "nationality",
    ...(flags?.genderField ? ["gender"] : []),
    "phone",
    "email",
    "residentialAddress",
    "professionalSameAsResidential",
    ...(b.professionalSameAsResidential === false ? ["professionalAddress"] : []),
    "occupation",
  ];
  return fields;
}

export interface ProfileCompletion {
  done: number;
  total: number;
  /** 0–100. */
  percent: number;
  /** Fields still missing or invalid, in form order. */
  missing: string[];
  complete: boolean;
}

/**
 * How complete a profile is, judged by the same check as Section B, so "complete" means the
 * application will accept it. An address counts as one answer however many parts it has.
 */
export function profileCompletion(
  b: SectionB | undefined,
  ctx: Pick<SectionContext, "today" | "flags">,
  /** Identity documents on the profile (type → a clean file is present); counted when given. */
  documents?: Partial<Record<string, boolean>>,
): ProfileCompletion {
  const data = b ?? {};
  const issues = checkSectionB(data, { ...ctx, type: "NEW", category: "RERA" });
  const answers = profileFields(data, ctx.flags);
  const docTypes = documents ? Object.keys(documents) : [];
  const fields = [...answers, ...docTypes];
  const missing = [
    ...answers.filter((f) =>
      Object.keys(issues).some((path) => path === f || path.startsWith(`${f}.`)),
    ),
    ...docTypes.filter((type) => !documents![type]),
  ];
  const done = fields.length - missing.length;
  return {
    done,
    total: fields.length,
    percent: Math.round((done / fields.length) * 100),
    missing,
    complete: missing.length === 0,
  };
}

export function checkSectionC(c: SectionC = {}, ctx: SectionContext): Issues {
  const issues: Issues = {};
  req(issues, "highestLevel", c.highestLevel);
  const list = c.qualifications ?? [];
  if (list.length === 0) issues.qualifications = "validation.atLeastOne";
  const year = Number(ctx.today.slice(0, 4));
  list.forEach((q, i) => {
    const p = `qualifications.${i}`;
    req(issues, `${p}.institution`, q.institution);
    req(issues, `${p}.qualification`, q.qualification);
    req(issues, `${p}.fieldOfStudy`, q.fieldOfStudy);
    if (q.fieldOfStudy === "OTHER") req(issues, `${p}.fieldOther`, q.fieldOther);
    if (q.yearCompleted === undefined) issues[`${p}.yearCompleted`] = "validation.required";
    else if (q.yearCompleted < 1950 || q.yearCompleted > year)
      issues[`${p}.yearCompleted`] = "validation.yearRange";
    if (q.isForeign === undefined) issues[`${p}.isForeign`] = "validation.required";
  });
  if (list.length > 0 && !list.some((q) => q.reliedUpon))
    issues.qualifications = "validation.reliedUpon";
  return issues;
}

export function checkSectionD(d: SectionD = {}, ctx: SectionContext): Issues {
  const issues: Issues = {};
  if (d.trainingCompleted === undefined) issues.trainingCompleted = "validation.required";
  if (d.trainingCompleted) {
    req(issues, "trainingProvider", d.trainingProvider);
    if (d.trainingProvider === "OTHER")
      req(issues, "trainingProviderOther", d.trainingProviderOther);
    req(issues, "trainingProgramme", d.trainingProgramme);
    checkPastDate(issues, "trainingCompletedOn", d.trainingCompletedOn, ctx.today);
    req(issues, "trainingCertificateNo", d.trainingCertificateNo);
  }
  req(issues, "examPassed", d.examPassed);
  if (d.examPassed === "NOT_APPLICABLE" && EXAM_CATEGORIES.includes(ctx.category))
    issues.examPassed = "validation.examRequired";
  if (d.examPassed === "YES") {
    req(issues, "examReference", d.examReference);
    checkPastDate(issues, "examDate", d.examDate, ctx.today);
  }
  return issues;
}

export function checkSectionE(e: SectionE = {}, ctx: SectionContext): Issues {
  const issues: Issues = {};
  const records = e.records ?? [];
  if (records.length === 0 && !e.equivalentRecognised) issues.records = "validation.atLeastOne";
  records.forEach((r, i) => {
    const p = `records.${i}`;
    req(issues, `${p}.firm`, r.firm);
    req(issues, `${p}.category`, r.category);
    checkPastDate(issues, `${p}.from`, r.from, ctx.today);
    if (!r.current) {
      checkPastDate(issues, `${p}.to`, r.to, ctx.today);
      if (!blank(r.from) && !blank(r.to) && r.to! < r.from!)
        issues[`${p}.to`] = "validation.dateOrder";
    }
    req(issues, `${p}.duties`, r.duties);
  });
  req(issues, "priorCategoryForExperience", e.priorCategoryForExperience);
  checkPastDate(issues, "initialRegistrationDate", e.initialRegistrationDate, ctx.today);
  if (e.equivalentRecognised === undefined) issues.equivalentRecognised = "validation.required";
  if (e.equivalentRecognised) req(issues, "equivalenceReference", e.equivalenceReference);
  if (!blank(e.refereeEmail) && !EMAIL.test(e.refereeEmail!))
    issues.refereeEmail = "validation.emailInvalid";
  return issues;
}

/** Latest allowed affiliation start: today + 30 days (FR-F-005, configurable). */
function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function checkSectionF(f: SectionF = {}, ctx: SectionContext): Issues {
  const issues: Issues = {};
  const { category } = ctx;
  const needsFirm = (() => {
    if (category === "RERA") return f.reraMode === "FIRM";
    if (category === "BROKER") return f.practiceArrangement === "AFFILIATED";
    return AFFILIATED_CATEGORIES.includes(category);
  })();

  if (category === "RERA") req(issues, "reraMode", f.reraMode);
  if (category === "BROKER") req(issues, "practiceArrangement", f.practiceArrangement);
  if (needsFirm) {
    // Asked once a firm is named ("Do you already work with them?", UX-004 Phase 3).
    const firmNamed = !blank(f.firmId) || !blank(f.firmName);
    if (
      category !== "ASSOCIATE_BROKER" &&
      category !== "MANAGING_BROKER" &&
      firmNamed &&
      f.isAffiliated === undefined
    )
      issues.isAffiliated = "validation.required";
    // Broker-tier designations need a registered firm; others may name a proposed firm manually.
    if (category === "ASSOCIATE_BROKER" || category === "MANAGING_BROKER")
      req(issues, "firmId", f.firmId);
    else if (blank(f.firmId) && blank(f.firmName)) issues.firmName = "validation.required";
    if (blank(f.affiliationStart)) issues.affiliationStart = "validation.required";
    else if (f.affiliationStart! > addDays(ctx.today, 30))
      issues.affiliationStart = "validation.affiliationTooLate";
  }
  if (category === "MANAGING_BROKER") req(issues, "branchId", f.branchId, "validation.required");
  if (category === "RERA" && f.reraMode === "REFERRAL") {
    req(issues, "referralArrangementName", f.referralArrangementName);
    req(issues, "referralApprovalRef", f.referralApprovalRef);
  }
  if (SUPERVISED_CATEGORIES.includes(category))
    req(issues, "supervisorLicenceNo", f.supervisorLicenceNo);
  if (category === "BROKER" && f.practiceArrangement === "INDEPENDENT")
    req(issues, "independentAuthorisationRef", f.independentAuthorisationRef);
  return issues;
}

export function checkSectionG(g: SectionG = {}, ctx: SectionContext): Issues {
  const issues: Issues = {};
  const accept = (key: keyof SectionG) => {
    if (g[key] !== true) issues[key] = "validation.mustAccept";
  };
  switch (ctx.category) {
    case "RERA":
      accept("article10Ack");
      break;
    case "FSLA":
      if (!g.territory?.length) issues.territory = "validation.atLeastOne";
      accept("restrictionsAck");
      break;
    case "REA":
    case "BROKER":
      accept("dataConfirmed");
      break;
    case "ASSOCIATE_BROKER":
      req(issues, "brokerLicenceNo", g.brokerLicenceNo);
      accept("supervisionAck");
      break;
    case "MANAGING_BROKER":
      req(issues, "brokerLicenceNo", g.brokerLicenceNo);
      if (g.supervisedCount === undefined) issues.supervisedCount = "validation.required";
      if (!g.supervisoryFunctions?.length) issues.supervisoryFunctions = "validation.atLeastOne";
      break;
    case "PRINCIPAL_BROKER":
      req(issues, "brokerLicenceNo", g.brokerLicenceNo);
      req(issues, "proposedFirmRef", g.proposedFirmRef);
      if (ctx.flags?.indemnityRequired !== false) checkIndemnity(issues, g, ctx);
      if ((g.responsibilities ?? []).length < PRINCIPAL_RESPONSIBILITIES.length)
        issues.responsibilities = "validation.acceptAll";
      break;
    case "REBF": {
      for (const key of ["legalName", "companyRegNo"] as const) req(issues, key, g[key]);
      req(issues, "legalForm", g.legalForm);
      checkPastDate(issues, "incorporatedOn", g.incorporatedOn, ctx.today);
      checkAddress(issues, "registeredOffice", g.registeredOffice);
      if (g.placeSameAsOffice === undefined) issues.placeSameAsOffice = "validation.required";
      else if (!g.placeSameAsOffice) checkAddress(issues, "principalPlace", g.principalPlace);
      checkPhone(issues, "phone", g.phone);
      checkEmail(issues, "email", g.email);
      const people = g.responsiblePersons ?? [];
      if (people.length === 0) issues.responsiblePersons = "validation.atLeastOne";
      people.forEach((person, i) => {
        const p = `responsiblePersons.${i}`;
        req(issues, `${p}.name`, person.name);
        req(issues, `${p}.role`, person.role);
        req(issues, `${p}.idType`, person.idType);
        req(issues, `${p}.idNumber`, person.idNumber);
        req(issues, `${p}.nationality`, person.nationality);
      });
      req(issues, "principalBrokerLicenceNo", g.principalBrokerLicenceNo);
      (g.branches ?? []).forEach((branch, i) => {
        req(issues, `branches.${i}.name`, branch.name);
        checkAddress(issues, `branches.${i}.address`, branch.address);
      });
      if (ctx.flags?.indemnityRequired !== false) checkIndemnity(issues, g, ctx);
      if (g.hasSupervisoryManual !== true) issues.hasSupervisoryManual = "validation.mustAccept";
      if (g.clientFundsApplicable === undefined)
        issues.clientFundsApplicable = "validation.required";
      break;
    }
  }
  return issues;
}

function checkIndemnity(issues: Issues, g: SectionG, ctx: SectionContext) {
  const i = g.indemnity ?? {};
  req(issues, "indemnity.insurer", i.insurer);
  req(issues, "indemnity.policyNo", i.policyNo);
  if (i.cover === undefined) issues["indemnity.cover"] = "validation.required";
  req(issues, "indemnity.from", i.from);
  if (blank(i.to)) issues["indemnity.to"] = "validation.required";
  else if (i.to! <= ctx.today) issues["indemnity.to"] = "validation.documentExpired";
}

export function checkSectionH(h: SectionH = {}, ctx: SectionContext): Issues {
  const issues: Issues = {};
  for (const q of INTEGRITY_QUESTIONS) if (h[q] === undefined) issues[q] = "validation.required";
  const yes = INTEGRITY_QUESTIONS.filter((q) => h[q] === true);
  const disclosures = h.disclosures ?? [];
  if (yes.length > 0 && disclosures.length === 0)
    issues.disclosures = "validation.disclosureRequired";
  disclosures.forEach((d, i) => {
    const p = `disclosures.${i}`;
    req(issues, `${p}.question`, d.question);
    req(issues, `${p}.nature`, d.nature);
    checkPastDate(issues, `${p}.date`, d.date, ctx.today);
    req(issues, `${p}.authority`, d.authority);
    req(issues, `${p}.outcome`, d.outcome);
  });
  checkPastDate(issues, "criminalRecordIssuedOn", h.criminalRecordIssuedOn, ctx.today);
  if (h.codeOfConduct === undefined) issues.codeOfConduct = "validation.required";
  return issues;
}

const CHECKS: Record<SectionKey, (data: never, ctx: SectionContext) => Issues> = {
  b: checkSectionB,
  c: checkSectionC,
  d: checkSectionD,
  e: checkSectionE,
  f: checkSectionF,
  g: checkSectionG,
  h: checkSectionH,
};

export function checkSection(key: SectionKey, data: ApplicationData, ctx: SectionContext): Issues {
  return CHECKS[key](data[key] as never, ctx);
}

// ---------------------------------------------------------------------------
// Declaration and signature (Section J, FR-J-001…007)
// ---------------------------------------------------------------------------

export const declarationSchema = z.object({
  applicationId: z.uuid(),
  confirmed: z.literal(true, "validation.mustAccept"),
  /** REBF: the signatory's capacity, e.g. "Director" (FR-J-007). */
  capacity: z.string().trim().max(80).optional(),
  method: z.enum(["EMAIL", "SMS"]),
});

export const signSchema = z.object({
  applicationId: z.uuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "validation.otpInvalid"),
});
