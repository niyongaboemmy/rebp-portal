/**
 * Seeds demo accounts for every role (pilot only — synthetic data, R11).
 * Self-contained: runs under tsx outside Next.js, so it does not import server-only modules.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../src/generated/prisma/client";

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
];

async function main() {
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
  console.info(
    "Staff and Principal Broker accounts are asked to set up two-step verification on first sign-in.",
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
