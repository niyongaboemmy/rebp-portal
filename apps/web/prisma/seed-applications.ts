/**
 * Seeds synthetic applications for every category × status (pilot demo data only, R11): at least
 * SEED_APPLICATIONS_PER_STATUS (default 4) per cell, so every queue, filter, dashboard and journey
 * stage (FR-PORTAL-002, FR-BO-001) has realistic rows to show.
 *
 * Each application carries what its status implies, written the way the domain writes it:
 * section data that passes the completeness checks (FR-WIZ-013), encrypted documents
 * (FR-DOC-008), the signed snapshot (DATA-002), payments and receipts (FR-PAY-003…008),
 * confirmations (FR-F-007), eligibility runs (FR-ELG-003), reviews (FR-L-*), information requests
 * (FR-L-007), decisions (FR-M-*), issued licences on the register (FR-N-*) and the status timeline
 * (FR-WF-001). No notifications or audit events are written: the seed is not a user action.
 *
 * Run after `pnpm db:seed`: `pnpm db:seed:applications`. Idempotent — each category × status is
 * topped up to the target, so a re-run adds nothing. Seeded accounts use @seed.rebp.rw and the demo
 * password. Self-contained like seed.ts: runs under tsx, imports no server-only modules.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { createCipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addDays,
  addMonths,
  addYears,
  APPLICATION_STATUSES,
  BROKER_FIELDS,
  buildChecklist,
  calculateFees,
  CATEGORIES,
  checkSection,
  CONFIG_DEFAULTS,
  CONFIG_SCHEMAS,
  CONFIRMATION_TTL_DAYS,
  evaluateEligibility,
  formatLicenceNo,
  formatReference,
  formatRegistrationNo,
  isRequiredForSubmission,
  PRINCIPAL_RESPONSIBILITIES,
  REA_RELEVANT_FIELDS,
  sectionsFor,
  SLA,
  SUPERVISED_CATEGORIES,
  TEXT_VERSIONS,
  VERIFICATION_ITEMS,
  type ApplicationData,
  type ApplicationStatus,
  type ApplicationType,
  type Category,
  type ConfigKey,
  type DecisionCondition,
  type DocumentType,
  type EligibilityFacts,
  type EligibilityOutcome,
  type EligibilityResult,
  type LicenceFact,
  type SectionKey,
  type VerificationItem,
} from "@rebp/contracts";
import {
  Prisma,
  PrismaClient,
  type ConfirmationKind,
  type Licence,
  type Role,
  type User,
} from "../src/generated/prisma/client";
import { projectLicenceWith } from "../src/server/licensing/projection";
import { pdfOf, pngOf } from "../src/test/files";
import { districtCode, divisions } from "./data/admin-divisions";

const DOMAIN = "seed.rebp.rw";
const PER_CELL = Number(process.env.SEED_APPLICATIONS_PER_STATUS ?? 4);
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Rebp-Demo-Pilot-2026";
const SEED_CLIENT = { ipAddress: "127.0.0.1", userAgent: "rebp-seed" };

const DAY_MS = 86_400_000;
const NOW = new Date();
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
/** Calendar day in Kigali (UTC+2), like todayKigali(). */
const kigaliDay = (date: Date) =>
  new Date(date.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);
const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const plusDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const TODAY = kigaliDay(NOW);

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() !== 0 && result.getUTCDay() !== 6) added++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Deterministic randomness: the same cell always produces the same person and story
// ---------------------------------------------------------------------------

type Rng = () => number;

function rngFor(key: string): Rng {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pad = (n: number, width: number) => String(n).padStart(width, "0");
const hex = (bytes: number) => randomBytes(bytes).toString("hex").toUpperCase();

// ---------------------------------------------------------------------------
// Synthetic reference data (no real people, R11)
// ---------------------------------------------------------------------------

const GIVEN_FEMALE = [
  "Aline",
  "Claudine",
  "Divine",
  "Josiane",
  "Sandrine",
  "Yvonne",
  "Belyse",
  "Ange",
  "Clarisse",
  "Esperance",
  "Gisele",
  "Immaculée",
  "Jeanne",
  "Liliane",
  "Nadine",
  "Olive",
  "Pascaline",
  "Solange",
  "Vestine",
  "Chantal",
  "Florence",
  "Henriette",
  "Marie Claire",
  "Diane",
];
const GIVEN_MALE = [
  "Eric",
  "Patrick",
  "Olivier",
  "Emmanuel",
  "Fabrice",
  "Innocent",
  "Theogene",
  "Aimable",
  "Celestin",
  "Jean Paul",
  "Didier",
  "Gilbert",
  "Hubert",
  "Janvier",
  "Kevin",
  "Lambert",
  "Moise",
  "Placide",
  "Rene",
  "Serge",
  "Thierry",
  "Valens",
  "Yves",
  "Alexis",
];
const SURNAMES = [
  "Uwase",
  "Mugisha",
  "Ingabire",
  "Habimana",
  "Mukamana",
  "Niyonsaba",
  "Uwimana",
  "Mutoni",
  "Nkusi",
  "Uwamahoro",
  "Bizimana",
  "Iradukunda",
  "Niyonzima",
  "Uwera",
  "Kamanzi",
  "Umutoni",
  "Rukundo",
  "Twagirayezu",
  "Ishimwe",
  "Nshimiyimana",
  "Hakizimana",
  "Mukeshimana",
  "Nsengiyumva",
  "Uwingabire",
  "Munyaneza",
  "Ndayisaba",
  "Tuyishime",
  "Byiringiro",
  "Mbabazi",
  "Gatera",
  "Kayitesi",
  "Murenzi",
];
const FIRM_STEMS = [
  "Akagera",
  "Virunga",
  "Nyungwe",
  "Kivu",
  "Karisimbi",
  "Muhabura",
  "Rweru",
  "Nyabarongo",
  "Gishwati",
  "Bugesera",
  "Ihuriro",
  "Umuco",
  "Agaciro",
  "Inyange",
  "Imena",
  "Isange",
];
const FIRM_KINDS = [
  "Realty",
  "Properties",
  "Estates",
  "Homes",
  "Property Partners",
  "Land & Homes",
];
const DISTRICTS = [
  "Gasabo",
  "Kicukiro",
  "Nyarugenge",
  "Musanze",
  "Huye",
  "Rubavu",
  "Rusizi",
  "Muhanga",
  "Nyagatare",
  "Rwamagana",
  "Karongi",
  "Kayonza",
  "Bugesera",
  "Kamonyi",
  "Nyanza",
  "Rulindo",
  "Gicumbi",
  "Ngoma",
  "Kirehe",
  "Nyamasheke",
  "Rutsiro",
  "Ngororero",
  "Nyabihu",
  "Burera",
  "Gakenke",
  "Gisagara",
  "Nyaruguru",
  "Nyamagabe",
  "Ruhango",
  "Gatsibo",
];
const UNIVERSITIES = [
  "University of Rwanda",
  "University of Kigali",
  "Mount Kenya University Rwanda",
  "INES-Ruhengeri",
  "Adventist University of Central Africa",
  "University of Lay Adventists of Kigali",
];
const SCHOOLS = [
  "GS Kimironko",
  "Lycée de Kigali",
  "GS Saint André",
  "ES Kanombe",
  "GS Rambura",
  "Collège Saint Paul",
  "GS Remera Protestant",
  "ES Nyanza",
];
const INSURERS = [
  "Sonarwa General Insurance",
  "Radiant Insurance",
  "Prime Insurance",
  "Old Mutual Rwanda",
];
const DUTIES = [
  "Property viewings, client follow-up and listings.",
  "Sales negotiations, offers and handover of residential units.",
  "Letting and tenant management for a residential portfolio.",
  "Marketing commercial premises and preparing sale agreements.",
];

/** Sector-level addresses (province / district / sector codes) from the divisions dataset. */
const SECTORS = divisions()
  .filter((d) => d.level === 3)
  .map((d) => ({ province: d.code.slice(0, 1), district: d.parentCode!, sector: d.code }));

// ---------------------------------------------------------------------------
// Which status a person sits in, and the shape of each story
// ---------------------------------------------------------------------------

/** Statuses where an applicant may hold only one application per type and category. */
const OPEN: readonly ApplicationStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PENDING_CONFIRMATIONS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "FURTHER_ASSESSMENT",
  "PENDING_DECISION",
  "DEFERRED",
];
const APPROVALS: readonly ApplicationStatus[] = [
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "LICENSE_ISSUED",
];

/**
 * Applicant slot within the category's pool. Open applications get distinct applicants, so no one
 * has two open applications of a kind; approved applicants are separate people (they become
 * licensed); refused, withdrawn and expired files reuse open applicants, who applied again.
 */
function personIndex(status: ApplicationStatus, slot: number): number {
  if (OPEN.includes(status)) return OPEN.indexOf(status) * PER_CELL + slot;
  if (APPROVALS.includes(status))
    return (OPEN.length + APPROVALS.indexOf(status)) * PER_CELL + slot;
  const closed: readonly ApplicationStatus[] = ["REJECTED", "WITHDRAWN", "EXPIRED_DRAFT"];
  return closed.indexOf(status) * PER_CELL + slot;
}

/** How long ago the application was created, in days. */
const AGE_DAYS: Record<ApplicationStatus, [number, number]> = {
  DRAFT: [1, 40],
  PENDING_PAYMENT: [2, 12],
  PENDING_CONFIRMATIONS: [3, 9],
  SUBMITTED: [3, 10],
  UNDER_REVIEW: [8, 30],
  ACTION_REQUIRED: [12, 35],
  FURTHER_ASSESSMENT: [15, 45],
  PENDING_DECISION: [15, 45],
  APPROVED: [20, 60],
  APPROVED_WITH_CONDITIONS: [20, 60],
  DEFERRED: [20, 60],
  REJECTED: [25, 120],
  LICENSE_ISSUED: [30, 200],
  WITHDRAWN: [10, 90],
  EXPIRED_DRAFT: [100, 160],
};

type Step =
  | "signed"
  | "paid"
  | "confirmed"
  | "declined"
  | "reviewStarted"
  | "infoRequested"
  | "referred"
  | "reviewSigned"
  | "decided"
  | "withdrawn";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface FirmRef {
  id: string;
  legalName: string;
  companyRegNo: string;
  district: string;
  ownerId: string | null;
  principalLicenceId: string | null;
  /** A licence in the firm that may supervise RERA / FSLA / REA (BR-030). */
  supervisorNo: string;
}

interface Ctx {
  db: PrismaClient;
  passwordHash: string;
  firms: FirmRef[];
  officers: User[];
  approver: User;
  finance: User;
  fees: { version: number; value: (typeof CONFIG_DEFAULTS)["fees"] };
  thresholds: { version: number; value: (typeof CONFIG_DEFAULTS)["thresholds"] };
  flags: (typeof CONFIG_DEFAULTS)["flags"];
  storageRoot: string;
  blobKey: Buffer;
}

async function activeConfig<K extends ConfigKey>(db: PrismaClient, key: K) {
  const row = await db.configVersion.findFirst({
    where: { key, status: "ACTIVE", effectiveFrom: { lte: NOW } },
    orderBy: { version: "desc" },
  });
  const parsed = row ? CONFIG_SCHEMAS[key].safeParse(row.value) : null;
  return parsed?.success
    ? { version: row!.version, value: parsed.data as (typeof CONFIG_DEFAULTS)[K] }
    : { version: 0, value: CONFIG_DEFAULTS[key] };
}

// ---------------------------------------------------------------------------
// Encrypted blobs (same format as server/storage/blob-store.ts)
// ---------------------------------------------------------------------------

function sealBlob(ctx: Ctx, data: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ctx.blobKey, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([Buffer.from("RB1"), iv, cipher.getAuthTag(), ciphertext]);
}

async function storeBlob(ctx: Ctx, data: Buffer, at: Date): Promise<string> {
  const key = `${at.getUTCFullYear()}/${pad(at.getUTCMonth() + 1, 2)}/${randomBytes(18)
    .toString("base64url")
    .replace(/[^a-z0-9]/gi, "x")}`;
  const file = path.join(ctx.storageRoot, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, sealBlob(ctx, data), { mode: 0o600 });
  return key;
}

/** Canonical JSON, as in server/audit/audit.ts, so verifySnapshot() re-derives the same hash. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

async function nextval(db: PrismaClient, name: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ value: bigint }>>(
    `SELECT nextval('${name}') AS value`,
  );
  return Number(rows[0]!.value);
}

/** A licence number from licence_seq that is not already taken by the legacy register. */
async function nextLicenceNo(db: PrismaClient, category: Category, year: number) {
  for (;;) {
    const no = formatLicenceNo(category, year, await nextval(db, "licence_seq"));
    if (!(await db.licence.findUnique({ where: { licenceNo: no }, select: { id: true } })))
      return no;
  }
}

// ---------------------------------------------------------------------------
// Register look-ups (ports of server/applications/facts.ts)
// ---------------------------------------------------------------------------

async function licenceByNo(db: PrismaClient, licenceNo: string | undefined | null) {
  if (!licenceNo) return null;
  return db.licence.findFirst({
    where: { licenceNo: { equals: licenceNo.trim(), mode: "insensitive" } },
    include: { events: { select: { toStatus: true, startsOn: true, endsOn: true, at: true } } },
  });
}

type LicenceWithEvents = Licence & {
  events?: Array<{ toStatus: string; startsOn: Date | null; endsOn: Date | null; at: Date }>;
};

function toFact(licence: LicenceWithEvents, applicantId?: string): LicenceFact {
  return {
    licenceNo: licence.licenceNo,
    category: licence.category,
    status: licence.status,
    issuedAt: dayOf(licence.issuedAt),
    expiresAt: dayOf(licence.expiresAt),
    holderIsApplicant: applicantId ? licence.holderId === applicantId : undefined,
    suspensions: (licence.events ?? [])
      .filter((e) => e.toStatus === "SUSPENDED")
      .map((e) => ({ from: dayOf(e.startsOn ?? e.at), to: e.endsOn ? dayOf(e.endsOn) : null })),
  };
}

async function eligibilityAt(
  ctx: Ctx,
  app: { applicantId: string; category: Category; type: ApplicationType },
  data: ApplicationData,
  today: string,
): Promise<EligibilityResult> {
  const { db } = ctx;
  const held = await db.licence.findMany({
    where: { holderId: app.applicantId },
    include: { events: { select: { toStatus: true, startsOn: true, endsOn: true, at: true } } },
  });
  const facts: EligibilityFacts = { today, held: held.map((l) => toFact(l, app.applicantId)) };
  if (data.f?.supervisorLicenceNo) {
    const supervisor = await licenceByNo(db, data.f.supervisorLicenceNo);
    facts.supervisor = supervisor ? toFact(supervisor, app.applicantId) : null;
  }
  if (data.f?.firmId || data.f?.firmName) {
    const firm = data.f.firmId ? await db.firm.findUnique({ where: { id: data.f.firmId } }) : null;
    facts.firm = firm
      ? { found: true, status: firm.status, hasPrincipal: Boolean(firm.principalLicenceId) }
      : null;
  }
  if (app.category === "REBF" && data.g?.principalBrokerLicenceNo) {
    const principal = await licenceByNo(db, data.g.principalBrokerLicenceNo);
    facts.principal = principal ? toFact(principal) : null;
  }
  if (app.category === "MANAGING_BROKER" && data.f?.branchId) {
    const branch = await db.branch.findUnique({ where: { id: data.f.branchId } });
    if (branch) {
      const current = branch.managingLicenceId
        ? await db.licence.findUnique({ where: { id: branch.managingLicenceId } })
        : null;
      facts.branchHasManagingBroker = Boolean(
        current && current.status === "ACTIVE" && current.holderId !== app.applicantId,
      );
    }
  }
  return evaluateEligibility({
    type: app.type,
    category: app.category,
    data,
    facts,
    thresholds: ctx.thresholds.value,
  });
}

/** Who must confirm (port of plannedConfirmations, FR-F-007 / FR-G7-002 / FR-G8-008). */
async function plannedConfirmations(
  ctx: Ctx,
  app: { applicantId: string; category: Category },
  data: ApplicationData,
) {
  const { db } = ctx;
  const planned: Array<{
    kind: ConfirmationKind;
    addresseeId: string;
    licenceId: string | null;
    firmId: string | null;
  }> = [];
  if (SUPERVISED_CATEGORIES.includes(app.category) && data.f?.supervisorLicenceNo) {
    const supervisor = await licenceByNo(db, data.f.supervisorLicenceNo);
    if (supervisor?.holderId && supervisor.holderId !== app.applicantId)
      planned.push({
        kind: "SUPERVISOR",
        addresseeId: supervisor.holderId,
        licenceId: supervisor.id,
        firmId: data.f.firmId ?? null,
      });
  }
  const affiliated =
    (app.category === "RERA" && data.f?.reraMode === "FIRM") ||
    ["FSLA", "REA", "ASSOCIATE_BROKER", "MANAGING_BROKER"].includes(app.category) ||
    (app.category === "BROKER" && data.f?.practiceArrangement === "AFFILIATED");
  if (affiliated && data.f?.firmId) {
    const firm = await db.firm.findUnique({ where: { id: data.f.firmId } });
    const principal = firm?.principalLicenceId
      ? await db.licence.findUnique({ where: { id: firm.principalLicenceId } })
      : null;
    if (principal?.holderId && principal.holderId !== app.applicantId)
      planned.push({
        kind: "PRINCIPAL_BROKER",
        addresseeId: principal.holderId,
        licenceId: principal.id,
        firmId: firm!.id,
      });
  }
  if (app.category === "PRINCIPAL_BROKER" && data.g?.proposedFirmRef) {
    const firm = await db.firm.findUnique({ where: { companyRegNo: data.g.proposedFirmRef } });
    if (firm?.ownerId && firm.ownerId !== app.applicantId)
      planned.push({
        kind: "DESIGNATION",
        addresseeId: firm.ownerId,
        licenceId: null,
        firmId: firm.id,
      });
  }
  if (app.category === "REBF" && data.g?.principalBrokerLicenceNo) {
    const principal = await licenceByNo(db, data.g.principalBrokerLicenceNo);
    if (principal?.holderId && principal.holderId !== app.applicantId)
      planned.push({
        kind: "DESIGNATION",
        addresseeId: principal.holderId,
        licenceId: principal.id,
        firmId: null,
      });
  }
  const seen = new Set<string>();
  return planned.filter((p) => (seen.has(p.addresseeId) ? false : (seen.add(p.addresseeId), true)));
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

interface Person {
  user: User;
  index: number;
  givenNames: string;
  surname: string;
  /** Person-level history: everything predates the person's earliest possible application. */
  anchor: string;
  cv: Pick<ApplicationData, "c" | "d" | "e">;
  /** Broker-tier applicants and firm principals: their own Broker licence. */
  brokerLicenceNo?: string;
  /** REBF: the firm's proposed Principal Broker licence (held by a separate person). */
  principalLicenceNo?: string;
  firmName?: string;
}

const CATEGORY_CODE: Record<Category, number> = {
  RERA: 0,
  FSLA: 1,
  REA: 2,
  BROKER: 3,
  ASSOCIATE_BROKER: 4,
  MANAGING_BROKER: 5,
  PRINCIPAL_BROKER: 6,
  REBF: 7,
};
const PRINCIPAL_POOL = 8;
const slug = (category: Category) => category.toLowerCase().replace(/_/g, "-");

function nameFor(rng: Rng) {
  const female = rng() < 0.5;
  return {
    givenNames: pick(rng, female ? GIVEN_FEMALE : GIVEN_MALE),
    surname: pick(rng, SURNAMES),
    gender: female ? ("FEMALE" as const) : ("MALE" as const),
  };
}

/** Education, training and experience for a category, all dated before `anchor`. */
function cvFor(category: Category, rng: Rng, anchor: string): Person["cv"] {
  const secondaryYear = int(rng, 2006, 2016);
  const secondary = {
    id: "q-a2",
    institution: pick(rng, SCHOOLS),
    qualification: "A2 certificate",
    fieldOfStudy: "GENERAL_SECONDARY" as const,
    yearCompleted: secondaryYear,
    isForeign: false,
  };
  const degreeField =
    category === "REA" ? pick(rng, REA_RELEVANT_FIELDS) : pick(rng, BROKER_FIELDS);
  const degree = {
    id: "q-bachelor",
    institution: pick(rng, UNIVERSITIES),
    qualification: "Bachelor's degree",
    fieldOfStudy: degreeField,
    yearCompleted: Math.min(secondaryYear + 4, Number(anchor.slice(0, 4)) - 1),
    certificateNo: `UR-${int(rng, 10_000, 99_999)}`,
    isForeign: false,
  };
  const entry = category === "RERA" || category === "FSLA";
  const c = entry
    ? { highestLevel: "A2" as const, qualifications: [{ ...secondary, reliedUpon: true }] }
    : {
        highestLevel: "BACHELOR" as const,
        qualifications: [{ ...degree, reliedUpon: true }, secondary],
      };

  const programme =
    category === "FSLA" || category === "RERA"
      ? ("ENTRY" as const)
      : category === "REA"
        ? ("PROFESSIONAL" as const)
        : ("ADVANCED_BROKER" as const);
  const provider =
    programme === "ADVANCED_BROKER"
      ? pick(rng, ["PBTI", "EAPA"] as const)
      : pick(rng, ["PBTI", "KSRE"] as const);
  const trainingOn = addDays(anchor, -int(rng, 60, 500));
  const exam = category === "REA" || category === "BROKER" || category.endsWith("BROKER");
  const d = {
    trainingCompleted: true,
    trainingProvider: provider,
    trainingProgramme: programme,
    trainingCompletedOn: trainingOn,
    trainingCertificateNo: `${provider}-${programme.slice(0, 3)}-${trainingOn.slice(0, 4)}-${int(rng, 100, 999)}`,
    ...(exam
      ? {
          examPassed: "YES" as const,
          examReference: `EXAM-${trainingOn.slice(0, 4)}-${int(rng, 1000, 9999)}`,
          examDate: addDays(trainingOn, int(rng, 14, 50)),
        }
      : { examPassed: "NOT_APPLICABLE" as const }),
  };

  const firm = pick(rng, ["Keza Realty Ltd", "Inzu Properties Ltd", "Umurage Estates Ltd"]);
  const records =
    category === "RERA" || category === "FSLA"
      ? []
      : category === "REA"
        ? [
            {
              id: "x-fsla",
              firm,
              category: "FSLA" as const,
              from: addMonths(anchor, -int(rng, 40, 72)),
              current: true,
              duties: pick(rng, DUTIES),
            },
          ]
        : (() => {
            const reaFrom = addMonths(anchor, -int(rng, 42, 84));
            return [
              {
                id: "x-rea",
                firm,
                category: "REA" as const,
                from: reaFrom,
                current: true,
                duties: pick(rng, DUTIES),
              },
              {
                id: "x-fsla",
                firm,
                category: "FSLA" as const,
                from: addMonths(reaFrom, -int(rng, 24, 40)),
                to: addDays(reaFrom, -1),
                current: false,
                duties: pick(rng, DUTIES),
              },
            ];
          })();
  const e =
    records.length > 0
      ? {
          records,
          priorCategoryForExperience: category === "REA" ? ("FSLA" as const) : ("REA" as const),
          initialRegistrationDate: records[records.length - 1]!.from,
          equivalentRecognised: false,
        }
      : undefined;
  return { c, d: category === "RERA" ? undefined : d, e };
}

async function upsertUser(
  ctx: Ctx,
  spec: {
    email: string;
    fullName: string;
    phone: string;
    roles: Role[];
    accountType?: "INDIVIDUAL" | "ORGANISATION";
    profile?: object;
    cv?: object;
  },
) {
  return ctx.db.user.upsert({
    where: { email: spec.email },
    update: {},
    create: {
      email: spec.email,
      fullName: spec.fullName,
      phone: spec.phone,
      roles: spec.roles,
      accountType: spec.accountType ?? "INDIVIDUAL",
      emailVerifiedAt: NOW,
      phoneVerifiedAt: NOW,
      passwordHash: ctx.passwordHash,
      passwordChangedAt: NOW,
      ...(spec.profile ? { profile: json(spec.profile), profileUpdatedAt: NOW } : {}),
      ...(spec.cv ? { cv: json(spec.cv), cvUpdatedAt: NOW } : {}),
    },
  });
}

/** A licence migrated from the legacy register (as seed.ts writes them), projected publicly. */
async function legacyLicence(
  ctx: Ctx,
  holder: User,
  displayName: string,
  category: Category,
  rng: Rng,
  {
    affiliatedFirmId = null,
    arrangement = "AFFILIATED",
  }: { affiliatedFirmId?: string | null; arrangement?: string },
) {
  const { db } = ctx;
  const existing = await db.licence.findFirst({ where: { holderId: holder.id, category } });
  if (existing) return existing;
  const registrant =
    (await db.registrant.findUnique({ where: { userId: holder.id } })) ??
    (await db.registrant.create({
      data: {
        kind: "PERSON",
        registrationNo: formatRegistrationNo("PERSON", await nextval(db, "registrant_person_seq")),
        userId: holder.id,
        displayName,
      },
    }));
  const issuedAt = `${int(rng, 2020, 2024)}-${pad(int(rng, 1, 12), 2)}-${pad(int(rng, 1, 28), 2)}`;
  const licence = await db.licence.create({
    data: {
      licenceNo: await nextLicenceNo(db, category, Number(issuedAt.slice(0, 4))),
      registrantId: registrant.id,
      holderId: holder.id,
      category,
      displayName,
      issuedAt: dateOf(issuedAt),
      // Past the Broker-expiry warning window (BR-031) so designations aren't flagged.
      expiresAt: dateOf(
        `${int(rng, 2027, 2028)}-${pad(int(rng, 3, 12), 2)}-${pad(int(rng, 1, 28), 2)}`,
      ),
      practiceArrangement: arrangement,
      affiliatedFirmId,
      qrToken: randomBytes(18).toString("base64url"),
    },
  });
  await db.licenceEvent.create({
    data: {
      licenceId: licence.id,
      toStatus: "ACTIVE",
      action: "MIGRATED",
      reason: "Legacy register (synthetic pilot data)",
      startsOn: dateOf(issuedAt),
    },
  });
  if (affiliatedFirmId)
    await db.affiliation.create({
      data: { licenceId: licence.id, firmId: affiliatedFirmId, startsOn: dateOf(issuedAt) },
    });
  await projectLicenceWith(db, licence.id);
  return licence;
}

const people = new Map<string, Person>();

async function personFor(ctx: Ctx, category: Category, index: number): Promise<Person> {
  const key = `${category}:${index}`;
  const cached = people.get(key);
  if (cached) return cached;
  const rng = rngFor(`person:${key}`);
  const code = CATEGORY_CODE[category];
  const email = `${slug(category)}.${pad(index + 1, 2)}@${DOMAIN}`;
  const phone = `+25078910${code}${pad(index, 3)}`;
  // History predates the oldest application the seed can create (≈200 days ago).
  const anchor = addDays(TODAY, -240);
  const name = nameFor(rng);
  let person: Person;

  if (category === "REBF") {
    const firmName = `${FIRM_STEMS[index % FIRM_STEMS.length]} ${FIRM_KINDS[Math.floor(index / FIRM_STEMS.length) % FIRM_KINDS.length]} Ltd`;
    const user = await upsertUser(ctx, {
      email,
      fullName: `${firmName} (rep. ${name.givenNames} ${name.surname})`,
      phone,
      roles: ["APPLICANT"],
      accountType: "ORGANISATION",
    });
    // The firm's proposed Principal Broker: a licensed Broker designated as Principal (BR-032).
    const prng = rngFor(`principal:${key}`);
    const pname = nameFor(prng);
    const principalName = `${pname.givenNames} ${pname.surname}`;
    const principal = await upsertUser(ctx, {
      email: `rebf-principal.${pad(index + 1, 2)}@${DOMAIN}`,
      fullName: principalName,
      phone: `+25078910${PRINCIPAL_POOL}${pad(index, 3)}`,
      roles: ["APPLICANT", "SUPERVISOR", "PRINCIPAL_BROKER"],
    });
    await legacyLicence(ctx, principal, principalName, "BROKER", prng, {
      arrangement: "INDEPENDENT",
    });
    const pb = await legacyLicence(ctx, principal, principalName, "PRINCIPAL_BROKER", prng, {
      arrangement: "FIRM_PRINCIPAL",
    });
    person = {
      user,
      index,
      givenNames: name.givenNames,
      surname: name.surname,
      anchor,
      cv: {},
      principalLicenceNo: pb.licenceNo,
      firmName,
    };
  } else {
    const fullName = `${name.givenNames} ${name.surname}`;
    const cv = cvFor(category, rng, anchor);
    const address = pick(rng, SECTORS);
    const yob = int(rng, 1972, 2001);
    const profile = {
      surname: name.surname,
      givenNames: name.givenNames,
      fullNameOnId: fullName,
      idType: "NATIONAL_ID",
      idNumber: `1${yob}${name.gender === "FEMALE" ? 7 : 8}${code}${pad(index, 9)}`,
      dateOfBirth: `${yob}-${pad(int(rng, 1, 12), 2)}-${pad(int(rng, 1, 28), 2)}`,
      gender: name.gender,
      nationality: ["RW"],
      phone,
      email,
      residentialAddress: address,
      professionalSameAsResidential: true,
      occupation: "Real estate practitioner",
    };
    const brokerTier = ["ASSOCIATE_BROKER", "MANAGING_BROKER", "PRINCIPAL_BROKER"].includes(
      category,
    );
    const user = await upsertUser(ctx, {
      email,
      fullName,
      phone,
      roles: brokerTier ? ["APPLICANT", "SUPERVISOR"] : ["APPLICANT"],
      profile,
      // The CV holds C–E without the per-application "relied upon" flag (UX-018).
      cv: {
        ...(cv.c
          ? {
              c: {
                ...cv.c,
                qualifications: cv.c.qualifications?.map(({ reliedUpon: _r, ...q }) => q),
              },
            }
          : {}),
        ...(cv.d ? { d: cv.d } : {}),
        ...(cv.e ? { e: cv.e } : {}),
      },
    });
    const broker = brokerTier
      ? await legacyLicence(ctx, user, fullName, "BROKER", rng, {
          affiliatedFirmId: ctx.firms[index % ctx.firms.length]!.id,
        })
      : null;
    person = {
      user,
      index,
      givenNames: name.givenNames,
      surname: name.surname,
      anchor,
      cv,
      brokerLicenceNo: broker?.licenceNo,
    };
  }
  people.set(key, person);
  return person;
}

const branches = new Map<string, string>();

/** A branch with no Managing Broker yet (BR-033), one per Managing Broker applicant and firm. */
async function branchFor(ctx: Ctx, firm: FirmRef, index: number) {
  const district = DISTRICTS[index % DISTRICTS.length]!;
  const name = `${district} office${index >= DISTRICTS.length ? ` ${Math.floor(index / DISTRICTS.length) + 1}` : ""}`;
  const key = `${firm.id}:${name}`;
  const cached = branches.get(key);
  if (cached) return cached;
  const existing = await ctx.db.branch.findFirst({ where: { firmId: firm.id, name } });
  const branch =
    existing ??
    (await ctx.db.branch.create({
      data: {
        firmId: firm.id,
        name,
        district: districtCode(district),
        address: { province: districtCode(district).slice(0, 1), district: districtCode(district) },
      },
    }));
  branches.set(key, branch.id);
  return branch.id;
}

// ---------------------------------------------------------------------------
// Section data
// ---------------------------------------------------------------------------

function sectionB(person: Person) {
  return person.user.profile as unknown as ApplicationData["b"];
}

async function sectionF(
  ctx: Ctx,
  category: Category,
  person: Person,
  firm: FirmRef,
  start: string,
  rng: Rng,
  forceAffiliated: boolean,
): Promise<ApplicationData["f"]> {
  const affiliation = { isAffiliated: true, firmId: firm.id, affiliationStart: start };
  switch (category) {
    case "RERA":
      return person.index % 5 === 4 && !forceAffiliated
        ? {
            reraMode: "REFERRAL",
            referralArrangementName: `${firm.legalName} referral desk`,
            referralApprovalRef: `REF-APP-${int(rng, 1000, 9999)}`,
            supervisorLicenceNo: firm.supervisorNo,
          }
        : { reraMode: "FIRM", ...affiliation, supervisorLicenceNo: firm.supervisorNo };
    case "FSLA":
    case "REA":
      return { ...affiliation, supervisorLicenceNo: firm.supervisorNo };
    case "BROKER":
      return person.index % 5 === 4 && !forceAffiliated
        ? {
            practiceArrangement: "INDEPENDENT",
            independentAuthorisationRef: `IND-AUTH-${int(rng, 1000, 9999)}`,
            independentNotes: "Independent practice from a registered office in Kigali.",
          }
        : { practiceArrangement: "AFFILIATED", ...affiliation };
    case "ASSOCIATE_BROKER":
      return { firmId: firm.id, affiliationStart: start };
    case "MANAGING_BROKER":
      return {
        firmId: firm.id,
        branchId: await branchFor(ctx, firm, person.index),
        affiliationStart: start,
      };
    default:
      return undefined;
  }
}

function sectionG(
  category: Category,
  person: Person,
  firm: FirmRef,
  rng: Rng,
  proposedFirmRef: string,
): ApplicationData["g"] {
  const indemnity = {
    insurer: pick(rng, INSURERS),
    policyNo: `PI-${int(rng, 100_000, 999_999)}`,
    cover: pick(rng, [50_000_000, 100_000_000, 150_000_000]),
    from: "2026-01-01",
    to: "2027-12-31",
  };
  switch (category) {
    case "RERA":
      return { article10Ack: true };
    case "FSLA":
      return {
        territory: [...new Set([firm.district, pick(rng, ["11", "12", "13"])])],
        restrictionsAck: true,
      };
    case "REA":
    case "BROKER":
      return { dataConfirmed: true };
    case "ASSOCIATE_BROKER":
      return { brokerLicenceNo: person.brokerLicenceNo, supervisionAck: true };
    case "MANAGING_BROKER":
      return {
        brokerLicenceNo: person.brokerLicenceNo,
        supervisedCount: int(rng, 2, 12),
        supervisoryFunctions: ["TRANSACTIONS", "TRAINING", "COMPLIANCE"],
        supervisoryNotes: "Weekly file reviews and monthly compliance checks for branch agents.",
      };
    case "PRINCIPAL_BROKER":
      return {
        brokerLicenceNo: person.brokerLicenceNo,
        proposedFirmRef,
        indemnity,
        responsibilities: [...PRINCIPAL_RESPONSIBILITIES],
      };
    case "REBF": {
      const office = pick(rng, SECTORS);
      const director = nameFor(rng);
      return {
        legalName: person.firmName,
        tradingName: person.firmName!.replace(/ Ltd$/, ""),
        legalForm: "PRIVATE_LIMITED",
        companyRegNo: proposedFirmRef,
        tin: String(int(rng, 100_000_000, 199_999_999)),
        incorporatedOn: addDays(person.anchor, -int(rng, 200, 2000)),
        registeredOffice: office,
        placeSameAsOffice: true,
        phone: person.user.phone ?? undefined,
        email: `info@${person.firmName!.split(" ")[0]!.toLowerCase()}${person.index + 1}.example.rw`,
        responsiblePersons: [
          {
            id: "rp-1",
            name: `${person.givenNames} ${person.surname}`,
            role: "Managing Director",
            idType: "NATIONAL_ID",
            idNumber: `1198${int(rng, 0, 9)}8${pad(person.index, 10)}`,
            nationality: "RW",
            shareholding: 60,
          },
          {
            id: "rp-2",
            name: `${director.givenNames} ${director.surname}`,
            role: "Director",
            idType: "NATIONAL_ID",
            idNumber: `1199${int(rng, 0, 9)}7${pad(person.index, 10)}`,
            nationality: "RW",
            shareholding: 40,
          },
        ],
        principalBrokerLicenceNo: person.principalLicenceNo,
        branches: [],
        indemnity,
        clientFundsApplicable: rng() < 0.5,
        hasSupervisoryManual: true,
      };
    }
  }
}

function sectionH(issuedOn: string, disclosure: boolean, anchor: string): ApplicationData["h"] {
  return {
    criminalConviction: false,
    disciplinarySanction: disclosure,
    licenceRevoked: false,
    currentRestriction: false,
    ...(disclosure
      ? {
          disclosures: [
            {
              id: "d-1",
              question: "disciplinarySanction",
              nature: "Written warning for late reconciliation of a client deposit",
              date: addYears(anchor, -2),
              authority: "Rwanda Real Estate Brokers Association",
              outcome: "Warning issued; no further action",
              currentStatus: "Closed",
            },
          ],
        }
      : {}),
    criminalRecordIssuedOn: issuedOn,
    codeOfConduct: true,
  };
}

// ---------------------------------------------------------------------------
// One application
// ---------------------------------------------------------------------------

const FILE_NAMES: Partial<Record<DocumentType, string>> = {
  photo: "passport-photo.png",
  proofOfIdentity: "national-id.pdf",
  criminalRecord: "criminal-record-certificate.pdf",
};
/** The application being written, removed again if writing it fails (so top-ups stay exact). */
const partial: { id: string | null } = { id: null };
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

interface Event {
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  actorId: string | null;
  reason: string;
  at: Date;
}

const CONDITIONS: Record<Category, DecisionCondition> = {
  RERA: {
    code: "SUPERVISED_PRACTICE",
    text: "Practice under the named supervisor for 12 months.",
    publicOnRegister: true,
  },
  FSLA: {
    code: "TERRITORY_LIMITED",
    text: "Field sales limited to the authorised districts.",
    publicOnRegister: true,
  },
  REA: {
    code: "REPORT_QUARTERLY",
    text: "Quarterly activity report to the Authority.",
    endsOn: addMonths(TODAY, 6),
    publicOnRegister: false,
  },
  BROKER: {
    code: "COMPLETE_TRAINING",
    text: "Complete the client-funds handling module within 6 months.",
    endsOn: addMonths(TODAY, 6),
    publicOnRegister: true,
  },
  ASSOCIATE_BROKER: {
    code: "SUPERVISED_PRACTICE",
    text: "Transactions countersigned by the Principal Broker for 6 months.",
    publicOnRegister: true,
  },
  MANAGING_BROKER: {
    code: "REPORT_QUARTERLY",
    text: "Quarterly branch supervision report.",
    endsOn: addMonths(TODAY, 12),
    publicOnRegister: false,
  },
  PRINCIPAL_BROKER: {
    code: "PROVIDE_INSURANCE",
    text: "Renew professional indemnity cover before expiry.",
    publicOnRegister: false,
  },
  REBF: {
    code: "PROVIDE_INSURANCE",
    text: "File the renewed indemnity policy within 30 days of renewal.",
    publicOnRegister: false,
  },
};
const REJECTIONS = [
  {
    codes: ["INTEGRITY"],
    reasons:
      "The disclosed disciplinary history shows a pattern inconsistent with the integrity requirement.",
  },
  {
    codes: ["FALSE_INFORMATION"],
    reasons: "The experience declared could not be confirmed by the named firm.",
  },
  {
    codes: ["TRAINING_OR_EXAM"],
    reasons: "The training certificate could not be verified with the provider.",
  },
  {
    codes: ["NO_SUPERVISION", "OTHER"],
    reasons: "The supervision arrangement is not in place for the period applied for.",
  },
] as const;

async function createApplication(
  ctx: Ctx,
  category: Category,
  status: ApplicationStatus,
  slot: number,
) {
  const { db } = ctx;
  const rng = rngFor(`${category}:${status}:${slot}`);
  const person = await personFor(ctx, category, personIndex(status, slot));
  const applicant = person.user;
  const type: ApplicationType = category === "REBF" ? "FIRM_REGISTRATION" : "NEW";

  // Story shape.
  const declinedVariant = status === "ACTION_REQUIRED" && slot % 4 === 3;
  const withdrawFrom =
    status === "WITHDRAWN"
      ? (["DRAFT", "PENDING_PAYMENT", "SUBMITTED", "UNDER_REVIEW"] as const)[slot % 4]!
      : null;
  const throughConfirmations = status === "PENDING_CONFIRMATIONS" || declinedVariant;
  // Confirmations need register links with real addressees: Keza Realty's supervisor and Principal.
  const firm = throughConfirmations ? ctx.firms[0]! : ctx.firms[person.index % ctx.firms.length]!;
  const disclosure = status === "FURTHER_ASSESSMENT" || status === "REJECTED";
  const draftDepth =
    status === "DRAFT"
      ? slot % 4
      : status === "EXPIRED_DRAFT"
        ? 1 + (slot % 2)
        : withdrawFrom === "DRAFT"
          ? 2
          : 3;

  // Timeline: created, then each step spread up to shortly before now.
  const [minAge, maxAge] = AGE_DAYS[status];
  const created = new Date(NOW.getTime() - (minAge + rng() * (maxAge - minAge)) * DAY_MS);
  const createdDay = kigaliDay(created);
  const proposedFirmRef =
    category === "PRINCIPAL_BROKER" && throughConfirmations
      ? firm.companyRegNo
      : `RDB-${category === "REBF" ? 3 : 2}${pad(person.index, 4)}${pad(CATEGORY_CODE[category], 2)}`;

  // Section data (FR-WIZ-004 stores what the applicant entered).
  const applicable = sectionsFor(type, category);
  const full: ApplicationData = {
    b: category === "REBF" ? undefined : sectionB(person),
    ...person.cv,
    f: await sectionF(ctx, category, person, firm, createdDay, rng, throughConfirmations),
    g: sectionG(category, person, firm, rng, proposedFirmRef),
    h: sectionH(addDays(createdDay, -int(rng, 5, 45)), disclosure, person.anchor),
  };
  const data: ApplicationData = {};
  // Drafts are prefilled from the profile and CV (UX-010/018) and filled in step by step.
  const prefilled: SectionKey[] = ["b", "c", "d", "e"];
  const order = applicable.filter((k) => !prefilled.includes(k));
  const filled = new Set<SectionKey>([
    ...applicable.filter((k) => prefilled.includes(k)),
    ...order.slice(0, draftDepth >= 3 ? order.length : draftDepth),
  ]);
  for (const key of applicable)
    if (filled.has(key) && full[key]) (data as Record<string, unknown>)[key] = full[key];
  if (category === "REBF" && !filled.has("g"))
    data.g = { legalName: full.g?.legalName, email: full.g?.email, phone: full.g?.phone };
  const lastStep = draftDepth >= 3 ? "review" : (order[draftDepth] ?? "i");

  const checklist = buildChecklist({ type, category, data: full })
    .filter(isRequiredForSubmission)
    .map((item) => item.type);
  const documentTypes =
    draftDepth >= 3
      ? checklist
      : draftDepth === 0
        ? []
        : draftDepth === 1
          ? checklist.filter(
              (t) => t === "proofOfIdentity" || t === "photo" || t === "companyRegistration",
            )
          : checklist.filter((t) => t !== "criminalRecord");

  const planned = await plannedConfirmations(ctx, { applicantId: applicant.id, category }, full);
  if (throughConfirmations && planned.length === 0)
    throw new Error(`${category}/${status}: expected confirmations but none are planned`);
  const confirmations = planned.length > 0;

  const pre: Step[] = ["signed", "paid", ...(confirmations ? (["confirmed"] as const) : [])];
  const steps: Step[] = (() => {
    switch (status) {
      case "DRAFT":
      case "EXPIRED_DRAFT":
        return [];
      case "PENDING_PAYMENT":
        return ["signed"];
      case "PENDING_CONFIRMATIONS":
        return ["signed", "paid"];
      case "SUBMITTED":
        return pre;
      case "UNDER_REVIEW":
        return [...pre, "reviewStarted"];
      case "ACTION_REQUIRED":
        return declinedVariant
          ? ["signed", "paid", "declined"]
          : [...pre, "reviewStarted", "infoRequested"];
      case "FURTHER_ASSESSMENT":
        return [...pre, "reviewStarted", "referred"];
      case "PENDING_DECISION":
        return [...pre, "reviewStarted", "reviewSigned"];
      case "WITHDRAWN": {
        const before: Step[] =
          withdrawFrom === "DRAFT"
            ? []
            : withdrawFrom === "PENDING_PAYMENT"
              ? ["signed"]
              : withdrawFrom === "SUBMITTED"
                ? pre
                : [...pre, "reviewStarted"];
        return [...before, "withdrawn"];
      }
      default:
        return [...pre, "reviewStarted", "reviewSigned", "decided"];
    }
  })();
  const end = new Date(
    NOW.getTime() -
      (0.1 + rng() * Math.min(2, (NOW.getTime() - created.getTime()) / DAY_MS / 4)) * DAY_MS,
  );
  const weights = steps.map(() => 0.5 + rng());
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = end.getTime() - created.getTime();
  let acc = 0;
  const times = weights.map((w) => new Date(created.getTime() + ((acc += w) / total) * span));
  // Drafts were last touched a little after creation; expired ones 90+ days ago (FR-WF-004).
  const draftTouched = new Date(
    created.getTime() + rng() * Math.min(5 * DAY_MS, NOW.getTime() - created.getTime()),
  );

  // The application row.
  const reference = formatReference(
    Number(createdDay.slice(0, 4)),
    type,
    await nextval(db, "application_ref_seq"),
  );
  const app = await db.application.create({
    data: {
      referenceNo: reference,
      type,
      category,
      applicantId: applicant.id,
      data: json(data),
      lastStep,
      createdAt: created,
      lastActivityAt: created,
    },
  });
  partial.id = app.id;
  const events: Event[] = [
    { fromStatus: null, toStatus: "DRAFT", actorId: applicant.id, reason: "created", at: created },
  ];
  let current = "DRAFT" as ApplicationStatus;
  const move = (to: ApplicationStatus, actorId: string | null, reason: string, at: Date) => {
    events.push({ fromStatus: current, toStatus: to, actorId, reason, at });
    current = to;
  };

  // Documents (FR-DOC-001…008): real files, encrypted at rest.
  const docs: Array<{ id: string; type: DocumentType; sha256: string; versionId: string }> = [];
  for (const [n, docType] of documentTypes.entries()) {
    const at = new Date(created.getTime() + (n + 1) * 60_000);
    const isPhoto = docType === "photo";
    const bytes = isPhoto
      ? pngOf(400 + (person.index % 17), 500)
      : pdfOf(`${docType} ${reference}`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const document = await db.document.create({
      data: {
        applicationId: app.id,
        type: docType,
        ownerId: applicant.id,
        status: "CLEAN",
        createdAt: at,
        versions: {
          create: {
            version: 1,
            fileName: FILE_NAMES[docType] ?? `${kebab(docType)}.pdf`,
            mimeType: isPhoto ? "image/png" : "application/pdf",
            size: bytes.length,
            sha256,
            storageKey: await storeBlob(ctx, bytes, at),
            scanStatus: "CLEAN",
            uploadedById: applicant.id,
            createdAt: at,
          },
        },
      },
      include: { versions: { select: { id: true } } },
    });
    docs.push({ id: document.id, type: docType, sha256, versionId: document.versions[0]!.id });
  }

  // Every signed file must pass the same completeness gate as the wizard (FR-WIZ-013).
  const signedSteps = steps.includes("signed");
  if (signedSteps || draftDepth >= 3) {
    const checkDay = signedSteps ? kigaliDay(times[0]!) : TODAY;
    const sctx = {
      type,
      category,
      today: checkDay,
      flags: { genderField: ctx.flags.genderField, indemnityRequired: ctx.flags.indemnityRequired },
    };
    for (const key of applicable) {
      const issues = checkSection(key, data, sctx);
      if (Object.keys(issues).length > 0)
        throw new Error(
          `${reference} ${category}/${status}: section ${key} incomplete ${JSON.stringify(issues)}`,
        );
    }
  }

  const fields: Prisma.ApplicationUncheckedUpdateInput = {};
  const officer = ctx.officers[(person.index + CATEGORY_CODE[category]) % ctx.officers.length]!;
  const fee = calculateFees(ctx.fees.value, { category, type });
  let eligibility: EligibilityResult | null = null;
  let paidAt: Date | null = null;
  const requests: Array<{ id: string; addresseeId: string }> = [];
  let reviewId: string | null = null;
  const verify = async (
    at: Date,
    which: (d: (typeof docs)[number], i: number) => boolean = () => true,
  ) => {
    const ids = docs.filter(which).map((d) => d.id);
    if (ids.length)
      await db.document.updateMany({
        where: { id: { in: ids }, status: "CLEAN" },
        data: { status: "VERIFIED", verifiedById: officer.id, verifiedAt: at },
      });
  };
  const assign = (at: Date) => {
    // Some new submissions wait in the "unassigned" view (FR-BO-002).
    if (status === "SUBMITTED" && slot < 2) return;
    fields.assignedOfficerId = officer.id;
    fields.assignedAt = new Date(at.getTime() + 5 * 60_000);
  };
  const submit = (at: Date, actorId: string | null) => {
    move("SUBMITTED", actorId, "submitted", at);
    fields.submittedAt = at;
    fields.slaDueAt = addWorkingDays(at, SLA.reviewStartDays);
    assign(at);
  };

  for (const [n, step] of steps.entries()) {
    const at = times[n]!;
    switch (step) {
      case "signed": {
        // FR-J-004 signature over the canonical snapshot (DATA-002); the submission eligibility run.
        const snapshotData: ApplicationData = {};
        for (const key of applicable)
          if (data[key] !== undefined) (snapshotData as Record<string, unknown>)[key] = data[key];
        const snapshotChecklist = [...docs]
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map((d) => ({ id: d.id, type: d.type, version: 1, status: "CLEAN", sha256: d.sha256 }));
        const signature = {
          signerId: applicant.id,
          signerName: applicant.fullName,
          capacity: category === "REBF" ? "Managing Director" : null,
          method: rng() < 0.7 ? "OTP_EMAIL" : "OTP_SMS",
          signedAt: at.toISOString(),
          ...SEED_CLIENT,
          declarationVersion: TEXT_VERSIONS.declaration,
          privacyVersion: TEXT_VERSIONS.privacyNotice,
          codeOfConductVersion: TEXT_VERSIONS.codeOfConduct,
        };
        const hash = createHash("sha256")
          .update(
            canonicalJson({
              reference,
              data: snapshotData,
              checklist: snapshotChecklist,
              signature,
            }),
          )
          .digest("hex");
        await db.applicationSnapshot.create({
          data: {
            applicationId: app.id,
            version: 1,
            data: json(snapshotData),
            checklist: json(snapshotChecklist),
            hash,
            signature: json({ ...signature, snapshotHash: hash }),
            createdAt: at,
          },
        });
        eligibility = await eligibilityAt(
          ctx,
          { applicantId: applicant.id, category, type },
          data,
          kigaliDay(at),
        );
        if (eligibility.outcome === "FAIL")
          throw new Error(
            `${reference} ${category}/${status}: eligibility FAIL ${JSON.stringify(eligibility.rules.filter((r) => r.outcome === "FAIL"))}`,
          );
        await db.eligibilityRun.create({
          data: {
            applicationId: app.id,
            context: "SUBMIT",
            outcome: eligibility.outcome,
            results: json({ rules: eligibility.rules, experience: eligibility.experience ?? null }),
            thresholdsVersion: ctx.thresholds.version,
            createdAt: at,
          },
        });
        fields.eligibilityOutcome = eligibility.outcome;
        fields.signedAt = at;
        move("PENDING_PAYMENT", applicant.id, "signed", at);
        if (status === "PENDING_PAYMENT")
          await paymentAttempt(ctx, app.id, applicant, fee, ctx.fees.version, slot, at);
        break;
      }
      case "paid": {
        // FR-PAY-003…008: an occasional failed attempt first; Finance waives a few fees.
        const waived = rng() < 0.1;
        if (!waived && rng() < 0.2)
          await paymentAttempt(
            ctx,
            app.id,
            applicant,
            fee,
            ctx.fees.version,
            2,
            new Date(at.getTime() - 20 * 60_000),
          );
        await settledPayment(ctx, app.id, applicant, fee, ctx.fees.version, at, waived, rng);
        paidAt = at;
        if (confirmations) {
          for (const p of planned) {
            const request = await db.confirmationRequest.create({
              data: {
                applicationId: app.id,
                kind: p.kind,
                addresseeId: p.addresseeId,
                licenceId: p.licenceId,
                firmId: p.firmId,
                dueAt: plusDays(at, CONFIRMATION_TTL_DAYS),
                createdAt: at,
              },
            });
            requests.push({ id: request.id, addresseeId: p.addresseeId });
          }
          move("PENDING_CONFIRMATIONS", waived ? ctx.finance.id : null, "paid", at);
        } else submit(at, null);
        break;
      }
      case "confirmed": {
        // Each addressee confirmed between payment and now (FR-F-007).
        const spanMs = at.getTime() - paidAt!.getTime();
        for (const [k, r] of requests.entries())
          await db.confirmationRequest.update({
            where: { id: r.id },
            data: {
              status: "CONFIRMED",
              respondedAt: new Date(paidAt!.getTime() + ((k + 1) / requests.length) * spanMs),
            },
          });
        submit(at, requests[requests.length - 1]!.addresseeId);
        break;
      }
      case "declined": {
        const [first, ...rest] = requests;
        await db.confirmationRequest.update({
          where: { id: first!.id },
          data: {
            status: "DECLINED",
            respondedAt: at,
            reason: "I have not agreed to supervise this applicant at our firm.",
          },
        });
        if (rest.length)
          await db.confirmationRequest.updateMany({
            where: { id: { in: rest.map((r) => r.id) } },
            data: { status: "CANCELLED", respondedAt: at },
          });
        move("ACTION_REQUIRED", first!.addresseeId, "confirmationDeclined", at);
        fields.unlockedSections = category === "REBF" ? ["g"] : ["f"];
        fields.unlockedDocuments = ["affiliationEvidence", "appointmentLetter", "designationProof"];
        break;
      }
      case "reviewStarted": {
        move("UNDER_REVIEW", officer.id, "reviewStarted", at);
        fields.slaDueAt = addWorkingDays(at, SLA.reviewCompleteDays);
        // The officer has verified the identity documents and started Section L (FR-L-003).
        await verify(
          new Date(at.getTime() + 30 * 60_000),
          (d) =>
            d.type === "proofOfIdentity" || d.type === "photo" || d.type === "companyRegistration",
        );
        const draftReview = status === "UNDER_REVIEW" ? slot < 3 : true;
        if (draftReview) {
          const review = await db.review.create({
            data: {
              applicationId: app.id,
              version: 1,
              officerId: officer.id,
              checks: { identity: { outcome: "VERIFIED", note: "Matches NIDA record." } },
              internalComment: "Identity checked; remaining items in progress.",
              createdAt: new Date(at.getTime() + 35 * 60_000),
            },
          });
          reviewId = review.id;
        }
        break;
      }
      case "infoRequested": {
        // FR-L-007: three request templates, each unlocking what it asks about.
        const variant = slot % 3;
        const sectionsUnlocked: SectionKey[] =
          variant === 1
            ? [applicable.includes("e") ? "e" : applicable.includes("f") ? "f" : "g"]
            : [];
        const documents: DocumentType[] = variant === 0 ? ["criminalRecord"] : [];
        const extra =
          variant === 2 ? "Letter from the firm confirming your current role" : undefined;
        if (variant === 0) {
          const doc = docs.find((d) => d.type === "criminalRecord");
          if (doc)
            await db.document.update({
              where: { id: doc.id },
              data: {
                status: "REJECTED",
                officerNote: "The certificate is not legible; please upload a clear scan.",
                verifiedById: officer.id,
                verifiedAt: at,
              },
            });
        }
        const dueAt = plusDays(at, SLA.informationResponseDays);
        await db.informationRequest.create({
          data: {
            applicationId: app.id,
            officerId: officer.id,
            template: ["missingDocument", "clarifyExperience", "custom"][variant]!,
            message: [
              "Please upload a clear copy of your criminal record certificate.",
              "Please clarify the dates and duties of the practice you declared, and update the section.",
              "Please upload a letter from the firm confirming your current role and start date.",
            ][variant]!,
            sections: sectionsUnlocked,
            documents,
            extraDocument: extra ?? null,
            dueAt,
            createdAt: at,
          },
        });
        move("ACTION_REQUIRED", officer.id, "informationRequested", at);
        fields.unlockedSections = sectionsUnlocked;
        fields.unlockedDocuments = documents;
        fields.extraDocuments = extra ? [extra] : [];
        fields.slaDueAt = dueAt;
        break;
      }
      case "referred":
      case "reviewSigned": {
        await verify(new Date(at.getTime() - 60 * 60_000));
        const recommendation =
          step === "referred"
            ? "REFER"
            : status === "REJECTED" || (status === "PENDING_DECISION" && slot === 3)
              ? "REJECT"
              : "APPROVE";
        await signReview(
          ctx,
          app.id,
          reviewId,
          officer,
          full,
          docs.map((d) => d.type),
          eligibility!,
          recommendation,
          slot,
          at,
        );
        if (step === "referred") move("FURTHER_ASSESSMENT", officer.id, "referred", at);
        else {
          move("PENDING_DECISION", officer.id, "reviewSigned", at);
          fields.slaDueAt = addWorkingDays(at, SLA.decisionDays);
        }
        break;
      }
      case "decided": {
        const decision =
          status === "LICENSE_ISSUED"
            ? slot === 3
              ? "APPROVED_WITH_CONDITIONS"
              : "APPROVED"
            : (status as "APPROVED" | "APPROVED_WITH_CONDITIONS" | "DEFERRED" | "REJECTED");
        const approval = decision === "APPROVED" || decision === "APPROVED_WITH_CONDITIONS";
        const rejection = REJECTIONS[slot % REJECTIONS.length]!;
        const conditions = decision === "APPROVED_WITH_CONDITIONS" ? [CONDITIONS[category]] : [];
        const record = await db.decision.create({
          data: {
            applicationId: app.id,
            approverId: ctx.approver.id,
            decision,
            approvedCategory: approval ? category : null,
            conditions: json(conditions),
            geoScope: category === "FSLA" ? (full.g?.territory ?? []) : [],
            reasons:
              decision === "APPROVED"
                ? null
                : decision === "APPROVED_WITH_CONDITIONS"
                  ? "Approved subject to the condition recorded, given the applicant's limited practice history."
                  : decision === "DEFERRED"
                    ? "Deferred pending an updated affiliation letter and confirmation of the supervision arrangement."
                    : rejection.reasons,
            reasonCodes: decision === "REJECTED" ? [...rejection.codes] : [],
            letterNo: `DL-${at.getUTCFullYear()}-${pad(await nextval(db, "letter_seq"), 6)}`,
            signedAt: at,
            signature: {
              approverId: ctx.approver.id,
              name: ctx.approver.fullName,
              title: "Approving Authority",
              method: "PASSWORD_REAUTH",
              at: at.toISOString(),
              ...SEED_CLIENT,
            },
            createdAt: at,
          },
        });
        move(decision, ctx.approver.id, `decision.${decision}`, at);
        fields.decidedAt = at;
        if (status === "LICENSE_ISSUED") {
          const issuedAt = new Date(at.getTime() + 60_000);
          await issueLicence(
            ctx,
            app.id,
            applicant,
            category,
            full,
            record.id,
            conditions,
            docs,
            issuedAt,
            reference,
          );
          move("LICENSE_ISSUED", ctx.approver.id, "licenceIssued", issuedAt);
        }
        break;
      }
      case "withdrawn":
        move("WITHDRAWN", applicant.id, "withdrawn", at);
        break;
    }
  }

  if (status === "EXPIRED_DRAFT")
    move("EXPIRED_DRAFT", null, "inactive", plusDays(draftTouched, 90));
  const lastActivity =
    steps.length > 0 || status === "EXPIRED_DRAFT" ? events[events.length - 1]!.at : draftTouched;
  if (current !== status) throw new Error(`${reference}: ended in ${current}, expected ${status}`);

  await db.applicationEvent.createMany({
    data: events.map((e) => ({ applicationId: app.id, ...e })),
  });
  await db.application.update({
    where: { id: app.id },
    data: {
      ...fields,
      status,
      lastActivityAt: status === "EXPIRED_DRAFT" ? draftTouched : lastActivity,
      updatedAt: lastActivity,
    },
  });
}

// ---------------------------------------------------------------------------
// Payments, review and licence
// ---------------------------------------------------------------------------

type Quote = ReturnType<typeof calculateFees>;
const METHODS = ["MOBILE_MONEY", "MOBILE_MONEY", "CARD", "BANK"] as const;

/** An attempt that has not settled: pending, failed or expired (FR-PAY-003/010). */
async function paymentAttempt(
  ctx: Ctx,
  applicationId: string,
  payer: User,
  quote: Quote,
  feeVersion: number,
  variant: number,
  at: Date,
) {
  if (variant % 4 === 0) return; // Signed, not yet started.
  const status = (["PENDING", "FAILED", "EXPIRED"] as const)[(variant % 4) - 1]!;
  await ctx.db.payment.create({
    data: {
      applicationId,
      reference: `PAY-${hex(6)}`,
      amount: quote.total,
      lines: json(quote.lines),
      feeVersion,
      method: "MOBILE_MONEY",
      msisdn: payer.phone,
      status,
      provider: "mock",
      payerId: payer.id,
      failureReason:
        status === "FAILED"
          ? "Insufficient funds"
          : status === "EXPIRED"
            ? "Checkout not completed"
            : null,
      createdAt: new Date(at.getTime() + 10 * 60_000),
    },
  });
}

async function settledPayment(
  ctx: Ctx,
  applicationId: string,
  payer: User,
  quote: Quote,
  feeVersion: number,
  at: Date,
  waived: boolean,
  rng: Rng,
) {
  if (waived) {
    await ctx.db.payment.create({
      data: {
        applicationId,
        reference: `WVR-${hex(6)}`,
        amount: quote.total,
        lines: json(quote.lines),
        feeVersion,
        method: "WAIVER",
        status: "WAIVED",
        provider: "finance",
        payerId: payer.id,
        waivedById: ctx.finance.id,
        waiverReason: "Fee waived under the pilot onboarding programme.",
        paidAt: at,
        createdAt: at,
      },
    });
    return;
  }
  const method = pick(rng, METHODS);
  await ctx.db.payment.create({
    data: {
      applicationId,
      reference: `PAY-${hex(6)}`,
      amount: quote.total,
      lines: json(quote.lines),
      feeVersion,
      method,
      msisdn: method === "MOBILE_MONEY" ? payer.phone : null,
      status: "PAID",
      provider: "mock",
      providerTxnId: `MOCK-${hex(6)}`,
      receiptNo: `RCT-${at.getUTCFullYear()}-${pad(await nextval(ctx.db, "receipt_seq"), 6)}`,
      payerId: payer.id,
      paidAt: at,
      createdAt: new Date(at.getTime() - 3 * 60_000),
    },
  });
}

const ITEM_RULES: Record<VerificationItem, string[]> = {
  identity: ["BR-001"],
  education: ["BR-010", "BR-011", "BR-012", "BR-013", "BR-014"],
  experience: ["BR-020", "BR-021", "BR-022"],
  trainingExam: ["BR-015", "BR-016"],
  affiliation: ["BR-030", "BR-031", "BR-032", "BR-033", "BR-035", "BR-036"],
  integrity: ["BR-060", "BR-061", "BR-062"],
};
const ITEM_DOCS: Record<VerificationItem, string[]> = {
  identity: ["proofOfIdentity", "photo", "directorsIdentity", "companyRegistration"],
  education: ["educationCertificate", "transcript", "foreignRecognition"],
  experience: ["experienceEvidence", "equivalenceDecision", "previousLicence"],
  trainingExam: ["trainingCertificate", "examResult", "managementTraining"],
  affiliation: [
    "affiliationEvidence",
    "referralApproval",
    "independentAuthorisation",
    "appointmentLetter",
    "designationProof",
  ],
  integrity: ["criminalRecord", "integrityDisclosure"],
};

/** A signed Section L record (FR-L-003…010), with BR-090 overrides reasoned. */
async function signReview(
  ctx: Ctx,
  applicationId: string,
  draftId: string | null,
  officer: User,
  data: ApplicationData,
  documentTypes: DocumentType[],
  eligibility: EligibilityResult,
  recommendation: "APPROVE" | "REFER" | "REJECT",
  slot: number,
  at: Date,
) {
  const checks = Object.fromEntries(
    VERIFICATION_ITEMS.map((item) => {
      const relevant =
        eligibility.rules.some((r) => ITEM_RULES[item].includes(r.id)) ||
        documentTypes.some((t) => ITEM_DOCS[item].includes(t));
      return [
        item,
        {
          outcome: relevant ? "VERIFIED" : "NA",
          ...(item === "integrity" && data.h?.disciplinarySanction
            ? { note: "Disclosure reviewed with the Association's file." }
            : {}),
        },
      ];
    }),
  );
  const computedEligibility: EligibilityOutcome =
    eligibility.outcome === "FAIL"
      ? "NOT_SATISFIED"
      : eligibility.outcome === "NEEDS_ASSESSMENT"
        ? "FURTHER_ASSESSMENT"
        : "SATISFIED";
  const chosen: EligibilityOutcome =
    recommendation === "APPROVE"
      ? "SATISFIED"
      : recommendation === "REFER"
        ? "FURTHER_ASSESSMENT"
        : "NOT_SATISFIED";
  const overridden = { documentation: false, eligibility: chosen !== computedEligibility };
  const rejection = REJECTIONS[slot % REJECTIONS.length]!;
  const fields = {
    officerId: officer.id,
    checks,
    documentation: "COMPLETE",
    eligibility: chosen,
    eligibilityOverrideReason: overridden.eligibility
      ? recommendation === "APPROVE"
        ? "Assessed items verified with the issuing bodies; requirement met."
        : recommendation === "REJECT"
          ? "On verification the evidence does not meet the requirement."
          : "The disclosure needs an assessment panel before a recommendation."
      : null,
    internalComment:
      recommendation === "APPROVE"
        ? "All items verified against the register and source documents."
        : recommendation === "REFER"
          ? "Integrity disclosure: refer for further assessment."
          : "Verification did not support the application.",
    applicantComment:
      recommendation === "APPROVE" && slot % 2 === 0
        ? "Thank you — your documents were complete and clear."
        : null,
    recommendation,
    reasonCodes: recommendation === "REJECT" ? [...rejection.codes] : [],
    reasons:
      recommendation === "APPROVE"
        ? null
        : recommendation === "REFER"
          ? "The disclosed sanction needs a panel assessment under the integrity requirement."
          : rejection.reasons,
    legalReference: recommendation === "REJECT" ? "Regulation REBP/2026, Art. 14" : null,
    computed: { documentation: "COMPLETE", eligibility: computedEligibility, overridden },
    signedAt: at,
    signature: {
      officerId: officer.id,
      name: officer.fullName,
      method: "PASSWORD_REAUTH",
      at: at.toISOString(),
      ...SEED_CLIENT,
    },
  };
  if (draftId) await ctx.db.review.update({ where: { id: draftId }, data: fields });
  else
    await ctx.db.review.create({ data: { applicationId, version: 1, ...fields, createdAt: at } });
}

/** Port of issueLicence (FR-N-001…009, BR-092) for a new licence. */
async function issueLicence(
  ctx: Ctx,
  applicationId: string,
  applicant: User,
  category: Category,
  data: ApplicationData,
  decisionId: string,
  conditions: DecisionCondition[],
  docs: Array<{ type: DocumentType; versionId: string }>,
  at: Date,
  reference: string,
) {
  const { db } = ctx;
  const issuedDay = kigaliDay(at);
  let firmId: string | null = null;
  let principal: Licence | null = null;
  if (category === "REBF") {
    const g = data.g!;
    principal = await licenceByNo(db, g.principalBrokerLicenceNo);
    const firm = await db.firm.create({
      data: {
        legalName: g.legalName!,
        tradingName: g.tradingName || null,
        companyRegNo: g.companyRegNo!,
        address: json(g.registeredOffice ?? {}),
        district: g.registeredOffice?.district ?? null,
        phone: g.phone ?? null,
        email: g.email ?? null,
        ownerId: applicant.id,
        principalLicenceId: principal!.id,
        status: "ACTIVE",
      },
    });
    firmId = firm.id;
    await db.licence.update({ where: { id: principal!.id }, data: { affiliatedFirmId: firm.id } });
  }
  const displayName =
    category === "REBF"
      ? data.g?.tradingName || data.g?.legalName || applicant.fullName
      : [data.b?.givenNames, data.b?.surname].filter(Boolean).join(" ") || applicant.fullName;
  const registrant = firmId
    ? await db.registrant.create({
        data: {
          kind: "FIRM",
          registrationNo: formatRegistrationNo("FIRM", await nextval(db, "registrant_firm_seq")),
          firmId,
          displayName,
        },
      })
    : ((await db.registrant.findUnique({ where: { userId: applicant.id } })) ??
      (await db.registrant.create({
        data: {
          kind: "PERSON",
          registrationNo: formatRegistrationNo(
            "PERSON",
            await nextval(db, "registrant_person_seq"),
          ),
          userId: applicant.id,
          displayName,
        },
      })));
  const supervisor = await licenceByNo(db, data.f?.supervisorLicenceNo);
  const affiliatedFirmId =
    category === "PRINCIPAL_BROKER" || category === "REBF" ? null : (data.f?.firmId ?? null);
  const branchId = category === "MANAGING_BROKER" ? (data.f?.branchId ?? null) : null;
  const licence = await db.licence.create({
    data: {
      licenceNo: await nextLicenceNo(db, category, Number(issuedDay.slice(0, 4))),
      registrantId: registrant.id,
      holderId: applicant.id,
      firmId,
      category,
      displayName,
      issuedAt: dateOf(issuedDay),
      expiresAt: dateOf(addYears(issuedDay, ctx.thresholds.value.licenceValidityYears)),
      applicationId,
      decisionId,
      scope: category === "FSLA" ? (data.g?.territory ?? []) : [],
      practiceArrangement:
        category === "RERA"
          ? data.f?.reraMode === "REFERRAL"
            ? "REFERRAL_ONLY"
            : "AFFILIATED"
          : category === "BROKER"
            ? (data.f?.practiceArrangement ?? "AFFILIATED")
            : category === "PRINCIPAL_BROKER"
              ? "FIRM_PRINCIPAL"
              : category === "REBF"
                ? "FIRM"
                : "AFFILIATED",
      conditions: json(conditions),
      supervisorLicenceId: supervisor?.id ?? null,
      affiliatedFirmId,
      branchId,
      qrToken: randomBytes(18).toString("base64url"),
      photoVersionId: docs.find((d) => d.type === "photo")?.versionId ?? null,
      createdAt: at,
    },
  });
  await db.licenceEvent.create({
    data: {
      licenceId: licence.id,
      toStatus: "ACTIVE",
      action: "ISSUED",
      reference,
      actorId: ctx.approver.id,
      at,
    },
  });
  if (affiliatedFirmId)
    await db.affiliation.create({
      data: {
        licenceId: licence.id,
        firmId: affiliatedFirmId,
        supervisorLicenceId: supervisor?.id ?? null,
        branchId,
        startsOn: dateOf(data.f?.affiliationStart ?? issuedDay),
      },
    });
  if (branchId)
    await db.branch.update({ where: { id: branchId }, data: { managingLicenceId: licence.id } });
  const roles: Role[] = [];
  if (
    ["REA", "BROKER", "ASSOCIATE_BROKER", "MANAGING_BROKER", "PRINCIPAL_BROKER"].includes(category)
  )
    roles.push("SUPERVISOR");
  if (category === "PRINCIPAL_BROKER") roles.push("PRINCIPAL_BROKER");
  if (category === "REBF") roles.push("FIRM_ADMIN");
  if (roles.length)
    await db.user.update({
      where: { id: applicant.id },
      data: {
        roles: [
          ...new Set([
            ...(await db.user.findUniqueOrThrow({ where: { id: applicant.id } })).roles,
            ...roles,
          ]),
        ],
      },
    });
  await projectLicenceWith(db, licence.id);
  if (principal) await projectLicenceWith(db, principal.id);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const appEnv =
    process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "dev");
  if (appEnv !== "dev")
    throw new Error(`Refusing to seed synthetic applications with APP_ENV=${appEnv}.`);
  if (!Number.isInteger(PER_CELL) || PER_CELL < 1 || PER_CELL > 20)
    throw new Error("SEED_APPLICATIONS_PER_STATUS must be an integer from 1 to 20.");
  const encryptionKey = process.env.APP_ENCRYPTION_KEY;
  if (!encryptionKey)
    throw new Error("APP_ENCRYPTION_KEY is required to encrypt seeded documents.");

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const demo = async (email: string) => {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw new Error(`${email} is missing: run \`pnpm db:seed\` first.`);
    return user;
  };
  const passwordHash = await hash(DEMO_PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const firmRows = await Promise.all(
    [
      ["Keza Realty Ltd", "BRK-2022-00104"],
      ["Inzu Properties Ltd", "PBK-2022-00107"],
      ["Umurage Estates Ltd", "PBK-2023-00109"],
    ].map(async ([legalName, supervisorNo]) => {
      const firm = await db.firm.findFirst({ where: { legalName } });
      if (!firm) throw new Error(`${legalName} is missing: run \`pnpm db:seed\` first.`);
      return {
        id: firm.id,
        legalName: firm.legalName,
        companyRegNo: firm.companyRegNo,
        district: firm.district ?? "12",
        ownerId: firm.ownerId,
        principalLicenceId: firm.principalLicenceId,
        supervisorNo: supervisorNo!,
      };
    }),
  );

  const ctx: Ctx = {
    db,
    passwordHash,
    firms: firmRows,
    officers: [],
    approver: await demo("approver@demo.rebp.rw"),
    finance: await demo("finance@demo.rebp.rw"),
    fees: await activeConfig(db, "fees"),
    thresholds: await activeConfig(db, "thresholds"),
    flags: (await activeConfig(db, "flags")).value,
    storageRoot: path.resolve(process.env.STORAGE_DIR ?? "./var/storage"),
    blobKey: Buffer.from(hkdfSync("sha256", encryptionKey, "rebp-blobs", "documents-v1", 32)),
  };
  // Three reviewing officers share the work, so "mine", "all" and workload views differ (FR-BO-002).
  ctx.officers = [
    await demo("officer@demo.rebp.rw"),
    await upsertUser(ctx, {
      email: `reviewer.1@${DOMAIN}`,
      fullName: "Alphonse Nzeyimana",
      phone: "+250789109001",
      roles: ["REVIEWING_OFFICER"],
    }),
    await upsertUser(ctx, {
      email: `reviewer.2@${DOMAIN}`,
      fullName: "Beatrice Mukarugwiza",
      phone: "+250789109002",
      roles: ["REVIEWING_OFFICER"],
    }),
  ];

  const existing = await db.application.groupBy({
    by: ["category", "status"],
    where: { applicant: { email: { endsWith: `@${DOMAIN}` } } },
    _count: { _all: true },
  });
  const have = new Map(existing.map((row) => [`${row.category}:${row.status}`, row._count._all]));
  let created = 0;
  for (const category of CATEGORIES) {
    for (const status of APPLICATION_STATUSES) {
      for (let slot = have.get(`${category}:${status}`) ?? 0; slot < PER_CELL; slot++) {
        try {
          await createApplication(ctx, category, status, slot);
        } catch (error) {
          if (partial.id)
            await db.application.delete({ where: { id: partial.id } }).catch(() => {});
          throw error;
        }
        partial.id = null;
        created++;
      }
    }
    console.info(`  ${category}: done`);
  }

  const totals = await db.application.count({
    where: { applicant: { email: { endsWith: `@${DOMAIN}` } } },
  });
  console.info(
    `Seeded ${created} applications (${totals} synthetic in total: ${CATEGORIES.length} categories × ` +
      `${APPLICATION_STATUSES.length} statuses × ≥${PER_CELL}). Accounts: *@${DOMAIN}, password ${DEMO_PASSWORD}.`,
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
