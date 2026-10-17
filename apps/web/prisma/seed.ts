/**
 * Seeds demo accounts for every role (pilot only — synthetic data, R11).
 * Self-contained: runs under tsx outside Next.js, so it does not import server-only modules.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  type Category,
  type LicenseStatus,
  type Role,
} from "../src/generated/prisma/client";
import { projectLicenceWith } from "../src/server/licensing/projection";
import { sampleCv } from "../src/test/sample-cv";
import { districtCode, divisions } from "./data/admin-divisions";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Rebp-Demo-Pilot-2026";

const DEMO_USERS: {
  email: string;
  fullName: string;
  roles: Role[];
  accountType?: "INDIVIDUAL" | "ORGANISATION";
}[] = [
  { email: "applicant@demo.rebp.rw", fullName: "Aline Uwase", roles: ["APPLICANT"] },
  {
    email: "supervisor@demo.rebp.rw",
    fullName: "Eric Mugisha",
    roles: ["APPLICANT", "SUPERVISOR"],
  },
  {
    email: "principal@demo.rebp.rw",
    fullName: "Grace Ingabire",
    roles: ["APPLICANT", "PRINCIPAL_BROKER", "FIRM_ADMIN"],
  },
  {
    email: "firm@demo.rebp.rw",
    fullName: "Keza Realty Ltd (rep. Patrick Nkusi)",
    roles: ["APPLICANT", "FIRM_ADMIN"],
    accountType: "ORGANISATION",
  },
  { email: "officer@demo.rebp.rw", fullName: "Jean Habimana", roles: ["REVIEWING_OFFICER"] },
  { email: "approver@demo.rebp.rw", fullName: "Diane Mukamana", roles: ["APPROVING_AUTHORITY"] },
  { email: "registrar@demo.rebp.rw", fullName: "Olivier Niyonsaba", roles: ["REGISTRAR"] },
  { email: "finance@demo.rebp.rw", fullName: "Claudine Uwimana", roles: ["FINANCE_OFFICER"] },
  { email: "admin@demo.rebp.rw", fullName: "Samuel Kagame", roles: ["SYSTEM_ADMIN"] },
  { email: "auditor@demo.rebp.rw", fullName: "Joyce Mutoni", roles: ["AUDITOR"] },
  // Licensed FSLA practitioner: 2 y 5 m of experience (UAT-03) and a licence in its renewal window (UAT-10).
  { email: "agent@demo.rebp.rw", fullName: "Jean Bosco Habyarimana", roles: ["APPLICANT"] },
  // Last, so earlier accounts keep their seeded phone numbers. A second officer: files can be assigned across the team and handed over (FR-BO-002/005).
  {
    email: "officer2@demo.rebp.rw",
    fullName: "Alice Mukandayisenga",
    roles: ["REVIEWING_OFFICER"],
  },
];

async function main() {
  // The demo password is public (docs/DEMO_ACCOUNTS.md): production is bootstrapped by
  // deploy/cpanel/create-admin.cjs instead, never by this seed.
  const appEnv =
    process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "dev");
  if (appEnv === "production")
    throw new Error("Refusing to seed demo accounts with APP_ENV=production.");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const passwordHash = await hash(DEMO_PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const now = new Date();

  for (const [index, user] of DEMO_USERS.entries()) {
    const phone = `+25078800${String(index).padStart(4, "0")}`;
    await db.user.upsert({
      where: { email: user.email },
      update: { roles: user.roles, fullName: user.fullName },
      create: {
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
        accountType: user.accountType ?? "INDIVIDUAL",
        phone,
        emailVerifiedAt: now,
        phoneVerifiedAt: now,
        passwordHash,
        passwordChangedAt: now,
      },
    });
  }
  // UX-010: individual applicants have a complete profile, so demos start at the dashboard (set
  // only when empty, so a re-seed never overwrites edits made in dev).
  for (const [index, user] of DEMO_USERS.entries()) {
    if ((user.accountType ?? "INDIVIDUAL") !== "INDIVIDUAL" || !user.roles.includes("APPLICANT"))
      continue;
    const [givenNames, ...rest] = user.fullName.split(" ");
    await db.user.updateMany({
      where: { email: user.email, profile: { equals: Prisma.DbNull } },
      data: {
        profileUpdatedAt: now,
        profile: {
          surname: rest.join(" "),
          givenNames,
          fullNameOnId: user.fullName,
          idType: "NATIONAL_ID",
          idNumber: `1199080000${String(index).padStart(6, "0")}`,
          dateOfBirth: "1990-01-15",
          gender: "UNDISCLOSED",
          nationality: ["RW"],
          phone: `+25078800${String(index).padStart(4, "0")}`,
          email: user.email,
          // Kigali › Gasabo › Kimihurura.
          residentialAddress: {
            province: "1",
            district: "12",
            sector: "1208",
            cell: "120803",
            village: "12080304",
          },
          professionalSameAsResidential: true,
          occupation: "Real estate practitioner",
        },
      },
    });
    // UX-021: and a complete CV, so they can apply straight away.
    await db.user.updateMany({
      where: { email: user.email, cv: { equals: Prisma.DbNull } },
      data: { cvUpdatedAt: now, cv: sampleCv() },
    });
  }
  console.info(`Seeded ${DEMO_USERS.length} demo users. Password: ${DEMO_PASSWORD}`);

  // Optional personal administrator, configured in the git-ignored .env so credentials never reach the repo.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const adminHash = await hash(adminPassword, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await db.user.upsert({
      where: { email: adminEmail },
      update: {
        roles: ["SYSTEM_ADMIN"],
        passwordHash: adminHash,
        passwordChangedAt: now,
        disabledAt: null,
        disabledReason: null,
      },
      create: {
        email: adminEmail,
        fullName: process.env.SEED_ADMIN_NAME?.trim() || adminEmail.split("@")[0]!,
        roles: ["SYSTEM_ADMIN"],
        emailVerifiedAt: now,
        phoneVerifiedAt: now,
        passwordHash: adminHash,
        passwordChangedAt: now,
      },
    });
    console.info(`Seeded administrator ${adminEmail} (password from SEED_ADMIN_PASSWORD).`);
  }
  await seedRegister(db);
  console.info(
    "Staff and Principal Broker accounts are asked to set up two-step verification on first sign-in.",
  );
  await db.$disconnect();
}

// ---------------------------------------------------------------------------
// Synthetic legacy register (FR-RA-004 stand-in; R11: no real personal data)
// ---------------------------------------------------------------------------

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

interface SeedLicence {
  licenceNo: string;
  displayName: string;
  category: Category;
  status?: LicenseStatus;
  issuedAt: string;
  expiresAt: string;
  holderEmail?: string;
  firm?: string;
  ownFirm?: string;
  branch?: string;
  supervisor?: string;
  scope?: string[];
  arrangement?: string;
}

async function seedRegister(db: PrismaClient) {
  for (const d of divisions()) {
    await db.adminDivision.upsert({
      where: { code: d.code },
      update: { name: d.name, level: d.level, parentCode: d.parentCode },
      create: d,
    });
  }

  const users = new Map(
    (
      await db.user.findMany({
        where: { email: { endsWith: "@demo.rebp.rw" } },
        select: { id: true, email: true },
      })
    ).map((u) => [u.email, u.id]),
  );

  const FIRMS = [
    {
      regNo: "RDB-101234567",
      legalName: "Keza Realty Ltd",
      tradingName: "Keza Realty",
      district: "Gasabo",
      owner: "firm@demo.rebp.rw",
      branches: [
        ["Kimihurura office", "Gasabo"],
        ["Kicukiro branch", "Kicukiro"],
      ],
    },
    {
      regNo: "RDB-102345678",
      legalName: "Inzu Properties Ltd",
      tradingName: "Inzu Properties",
      district: "Musanze",
      owner: undefined,
      branches: [["Musanze office", "Musanze"]],
    },
    {
      regNo: "RDB-103456789",
      legalName: "Umurage Estates Ltd",
      tradingName: null,
      district: "Huye",
      owner: undefined,
      branches: [["Huye office", "Huye"]],
    },
  ] as const;
  const firms = new Map<string, string>();
  const branches = new Map<string, string>();
  for (const f of FIRMS) {
    const firm = await db.firm.upsert({
      where: { companyRegNo: f.regNo },
      update: {},
      create: {
        companyRegNo: f.regNo,
        legalName: f.legalName,
        tradingName: f.tradingName,
        district: districtCode(f.district),
        address: {
          province: districtCode(f.district).slice(0, 1),
          district: districtCode(f.district),
        },
        status: "ACTIVE",
        ownerId: f.owner ? users.get(f.owner) : null,
        email: `info@${f.legalName.split(" ")[0]!.toLowerCase()}.example.rw`,
      },
    });
    firms.set(f.legalName, firm.id);
    for (const [name, district] of f.branches) {
      const existing = await db.branch.findFirst({ where: { firmId: firm.id, name } });
      const branch =
        existing ??
        (await db.branch.create({
          data: {
            firmId: firm.id,
            name,
            district: districtCode(district),
            address: { district: districtCode(district) },
          },
        }));
      branches.set(name, branch.id);
    }
  }

  const LICENCES: SeedLicence[] = [
    {
      licenceNo: "BRK-2021-00101",
      displayName: "Grace Ingabire",
      category: "BROKER",
      issuedAt: "2021-03-01",
      expiresAt: "2027-03-01",
      holderEmail: "principal@demo.rebp.rw",
      firm: "Keza Realty Ltd",
    },
    {
      licenceNo: "PBK-2023-00102",
      displayName: "Grace Ingabire",
      category: "PRINCIPAL_BROKER",
      issuedAt: "2023-02-01",
      expiresAt: "2027-02-01",
      holderEmail: "principal@demo.rebp.rw",
      firm: "Keza Realty Ltd",
      arrangement: "FIRM_PRINCIPAL",
    },
    {
      licenceNo: "FRM-2023-00103",
      displayName: "Keza Realty",
      category: "REBF",
      issuedAt: "2023-02-01",
      expiresAt: "2027-02-01",
      holderEmail: "firm@demo.rebp.rw",
      ownFirm: "Keza Realty Ltd",
      arrangement: "FIRM",
    },
    {
      licenceNo: "BRK-2022-00104",
      displayName: "Eric Mugisha",
      category: "BROKER",
      issuedAt: "2022-06-15",
      expiresAt: "2027-06-15",
      holderEmail: "supervisor@demo.rebp.rw",
      firm: "Keza Realty Ltd",
      branch: "Kimihurura office",
    },
    {
      licenceNo: "FSL-2024-00105",
      displayName: "Jean Bosco Habyarimana",
      category: "FSLA",
      issuedAt: "2024-05-15",
      expiresAt: "2026-11-20",
      holderEmail: "agent@demo.rebp.rw",
      firm: "Keza Realty Ltd",
      supervisor: "BRK-2022-00104",
      scope: [districtCode("Gasabo"), districtCode("Kicukiro")],
    },
    {
      licenceNo: "MBK-2024-00106",
      displayName: "Patrick Nkusi",
      category: "MANAGING_BROKER",
      issuedAt: "2024-01-10",
      expiresAt: "2027-01-10",
      firm: "Keza Realty Ltd",
      branch: "Kicukiro branch",
    },
    {
      licenceNo: "PBK-2022-00107",
      displayName: "Alice Uwamahoro",
      category: "PRINCIPAL_BROKER",
      issuedAt: "2022-09-01",
      expiresAt: "2027-09-01",
      firm: "Inzu Properties Ltd",
      arrangement: "FIRM_PRINCIPAL",
    },
    {
      licenceNo: "FRM-2022-00108",
      displayName: "Inzu Properties",
      category: "REBF",
      issuedAt: "2022-09-01",
      expiresAt: "2027-09-01",
      ownFirm: "Inzu Properties Ltd",
      arrangement: "FIRM",
    },
    {
      licenceNo: "PBK-2023-00109",
      displayName: "Emmanuel Ntawukuriryayo",
      category: "PRINCIPAL_BROKER",
      issuedAt: "2023-04-01",
      expiresAt: "2027-04-01",
      firm: "Umurage Estates Ltd",
      arrangement: "FIRM_PRINCIPAL",
    },
    {
      licenceNo: "FRM-2023-00110",
      displayName: "Umurage Estates Ltd",
      category: "REBF",
      issuedAt: "2023-04-01",
      expiresAt: "2027-04-01",
      ownFirm: "Umurage Estates Ltd",
      arrangement: "FIRM",
    },
    {
      licenceNo: "REA-2023-00111",
      displayName: "Claudine Mukeshimana",
      category: "REA",
      issuedAt: "2023-07-01",
      expiresAt: "2027-07-01",
      firm: "Inzu Properties Ltd",
      supervisor: "PBK-2022-00107",
    },
    {
      licenceNo: "REA-2022-00112",
      displayName: "Theogene Bizimana",
      category: "REA",
      issuedAt: "2022-03-20",
      expiresAt: "2027-03-20",
      firm: "Umurage Estates Ltd",
      supervisor: "PBK-2023-00109",
    },
    {
      licenceNo: "FSL-2025-00113",
      displayName: "Divine Iradukunda",
      category: "FSLA",
      issuedAt: "2025-02-01",
      expiresAt: "2027-02-01",
      firm: "Inzu Properties Ltd",
      supervisor: "REA-2023-00111",
      scope: [districtCode("Musanze")],
    },
    {
      licenceNo: "FSL-2025-00114",
      displayName: "Fabrice Niyonzima",
      category: "FSLA",
      issuedAt: "2025-04-12",
      expiresAt: "2027-04-12",
      firm: "Keza Realty Ltd",
      supervisor: "BRK-2022-00104",
      scope: [districtCode("Gasabo")],
    },
    {
      licenceNo: "RRA-2025-00115",
      displayName: "Yvonne Uwera",
      category: "RERA",
      issuedAt: "2025-05-05",
      expiresAt: "2027-05-05",
      firm: "Keza Realty Ltd",
      supervisor: "BRK-2022-00104",
    },
    {
      licenceNo: "RRA-2024-00116",
      displayName: "Olivier Kamanzi",
      category: "RERA",
      issuedAt: "2024-08-01",
      expiresAt: "2026-08-01",
      status: "EXPIRED",
      firm: "Umurage Estates Ltd",
      supervisor: "PBK-2023-00109",
    },
    {
      licenceNo: "ABK-2024-00117",
      displayName: "Sandrine Umutoni",
      category: "ASSOCIATE_BROKER",
      issuedAt: "2024-10-01",
      expiresAt: "2026-12-31",
      firm: "Inzu Properties Ltd",
    },
    {
      licenceNo: "BRK-2020-00118",
      displayName: "Innocent Habimana",
      category: "BROKER",
      issuedAt: "2020-01-15",
      expiresAt: "2027-01-15",
      status: "SUSPENDED",
      arrangement: "INDEPENDENT",
    },
    {
      licenceNo: "REA-2021-00119",
      displayName: "Josiane Mukamurenzi",
      category: "REA",
      issuedAt: "2021-11-11",
      expiresAt: "2026-11-11",
      status: "REVOKED",
      firm: "Umurage Estates Ltd",
    },
    {
      licenceNo: "BRK-2019-00120",
      displayName: "Celestin Rukundo",
      category: "BROKER",
      issuedAt: "2019-05-01",
      expiresAt: "2027-05-01",
      arrangement: "INDEPENDENT",
    },
    {
      licenceNo: "FSL-2025-00121",
      displayName: "Aimable Twagirayezu",
      category: "FSLA",
      issuedAt: "2025-06-30",
      expiresAt: "2027-06-30",
      firm: "Umurage Estates Ltd",
      supervisor: "REA-2022-00112",
      scope: [districtCode("Huye")],
    },
    {
      licenceNo: "REA-2024-00122",
      displayName: "Belyse Ishimwe",
      category: "REA",
      issuedAt: "2024-02-02",
      expiresAt: "2027-02-02",
      firm: "Keza Realty Ltd",
      supervisor: "BRK-2021-00101",
    },
  ];

  const ids = new Map<string, string>();
  for (const seed of LICENCES) {
    const existing = await db.licence.findUnique({ where: { licenceNo: seed.licenceNo } });
    if (existing) {
      ids.set(seed.licenceNo, existing.id);
      continue;
    }
    const holderId = seed.holderEmail ? (users.get(seed.holderEmail) ?? null) : null;
    const ownFirmId = seed.ownFirm ? firms.get(seed.ownFirm)! : null;
    let registrant = ownFirmId
      ? await db.registrant.findUnique({ where: { firmId: ownFirmId } })
      : holderId
        ? await db.registrant.findUnique({ where: { userId: holderId } })
        : await db.registrant.findFirst({
            where: { displayName: seed.displayName, kind: "PERSON", userId: null },
          });
    if (!registrant) {
      const seqName = ownFirmId ? "registrant_firm_seq" : "registrant_person_seq";
      const rows = await db.$queryRawUnsafe<Array<{ value: bigint }>>(
        `SELECT nextval('${seqName}') AS value`,
      );
      const value = rows[0]!.value;
      registrant = await db.registrant.create({
        data: {
          kind: ownFirmId ? "FIRM" : "PERSON",
          registrationNo: `${ownFirmId ? "RF" : "RP"}-${String(value).padStart(6, "0")}`,
          userId: ownFirmId ? null : holderId,
          firmId: ownFirmId,
          displayName: seed.displayName,
        },
      });
    }
    const affiliatedFirmId = seed.firm ? firms.get(seed.firm)! : null;
    const licence = await db.licence.create({
      data: {
        licenceNo: seed.licenceNo,
        registrantId: registrant.id,
        holderId,
        firmId: ownFirmId,
        category: seed.category,
        status: seed.status ?? "ACTIVE",
        displayName: seed.displayName,
        issuedAt: day(seed.issuedAt),
        expiresAt: day(seed.expiresAt),
        scope: seed.scope ?? [],
        practiceArrangement: seed.arrangement ?? "AFFILIATED",
        supervisorLicenceId: seed.supervisor ? (ids.get(seed.supervisor) ?? null) : null,
        affiliatedFirmId,
        branchId: seed.branch ? (branches.get(seed.branch) ?? null) : null,
        qrToken: randomBytes(18).toString("base64url"),
      },
    });
    ids.set(seed.licenceNo, licence.id);
    await db.licenceEvent.create({
      data: {
        licenceId: licence.id,
        toStatus: "ACTIVE",
        action: "MIGRATED",
        reason: "Legacy register (synthetic pilot data)",
        startsOn: day(seed.issuedAt),
      },
    });
    if (seed.status && seed.status !== "ACTIVE")
      await db.licenceEvent.create({
        data: {
          licenceId: licence.id,
          fromStatus: "ACTIVE",
          toStatus: seed.status,
          action:
            seed.status === "SUSPENDED"
              ? "SUSPEND"
              : seed.status === "REVOKED"
                ? "REVOKE"
                : "EXPIRED",
          reason: "Legacy register",
          startsOn: day("2026-06-01"),
        },
      });
    if (affiliatedFirmId && seed.category !== "PRINCIPAL_BROKER")
      await db.affiliation.create({
        data: {
          licenceId: licence.id,
          firmId: affiliatedFirmId,
          supervisorLicenceId: seed.supervisor ? ids.get(seed.supervisor) : null,
          startsOn: day(seed.issuedAt),
        },
      });
  }

  // Firm links: Principal Broker (BR-032) and branch managers (BR-033).
  const principals: Record<string, string> = {
    "Keza Realty Ltd": "PBK-2023-00102",
    "Inzu Properties Ltd": "PBK-2022-00107",
    "Umurage Estates Ltd": "PBK-2023-00109",
  };
  for (const [firm, licenceNo] of Object.entries(principals))
    await db.firm.update({
      where: { id: firms.get(firm)! },
      data: { principalLicenceId: ids.get(licenceNo)! },
    });
  await db.branch.update({
    where: { id: branches.get("Kicukiro branch")! },
    data: { managingLicenceId: ids.get("MBK-2024-00106")! },
  });

  for (const id of ids.values()) await projectLicenceWith(db, id);
  console.info(
    `Seeded ${divisions().length} divisions, ${firms.size} firms and ${ids.size} register entries.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
