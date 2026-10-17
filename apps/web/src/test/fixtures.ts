import { sampleCv } from "./sample-cv";
import { randomInt } from "node:crypto";
import type { Category, Role } from "@/generated/prisma/client";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { projectLicence } from "@/server/licensing/register";

/** Shared fixtures for domain integration tests (synthetic data only). */
export const PASSWORD = "sunny-kigali-hills-at-dawn";

let counter = 0;

export async function makeUser(
  roles: Role[] = ["APPLICANT"],
  {
    accountType = "INDIVIDUAL",
    fullName,
    profile = true,
    cv = true,
  }: {
    accountType?: "INDIVIDUAL" | "ORGANISATION";
    fullName?: string;
    /** UX-010: individual applicants get a complete profile unless a test needs none. */
    profile?: boolean;
    /** UX-021: and a complete CV, so they can apply. */
    cv?: boolean;
  } = {},
) {
  counter++;
  const now = new Date();
  const email = `user${counter}.${Date.now()}@test.rebp.rw`;
  // Unique across test files (each file restarts the counter; the database keeps earlier rows).
  const phone = `+25078${randomInt(0, 10_000_000).toString().padStart(7, "0")}`;
  const name = fullName ?? `Test Person ${counter}`;
  const [givenNames, ...rest] = name.split(" ");
  const withProfile = profile && accountType === "INDIVIDUAL" && roles.includes("APPLICANT");
  const user = await db.user.create({
    data: {
      email,
      phone,
      fullName: name,
      ...(withProfile && cv ? { cv: sampleCv(), cvUpdatedAt: now } : {}),
      ...(withProfile
        ? {
            profileUpdatedAt: now,
            profile: {
              // Names allow letters only ("Test Person 12" would fail the name check).
              surname:
                rest
                  .join(" ")
                  .replace(/[^\p{L}\s'-]/gu, "")
                  .trim() || "Person",
              givenNames: givenNames!.replace(/[^\p{L}'-]/gu, "") || "Test",
              idType: "NATIONAL_ID",
              idNumber: `1199080${String(counter).padStart(9, "0")}`,
              dateOfBirth: "1990-01-15",
              gender: "UNDISCLOSED",
              nationality: ["RW"],
              phone,
              email,
              residentialAddress: { province: "1", district: "12", sector: "1208" },
              professionalSameAsResidential: true,
              occupation: "Real estate practitioner",
            },
          }
        : {}),
      roles,
      accountType,
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
      passwordHash: await hashPassword(PASSWORD),
      mfaMethods: roles.some((r) => r !== "APPLICANT" && r !== "SUPERVISOR") ? ["TOTP"] : [],
    },
  });
  const { session } = await createSession(user, { method: "password", mfaVerified: true });
  return { user, session };
}

let licenceSeq = 900;

export async function makeLicence(
  holderId: string | null,
  category: Category,
  {
    firmId = null,
    affiliatedFirmId = null,
    issuedAt = "2022-01-01",
    expiresAt = "2027-06-01",
    displayName = "Licensed Person",
    status = "ACTIVE",
  }: {
    firmId?: string | null;
    affiliatedFirmId?: string | null;
    issuedAt?: string;
    expiresAt?: string;
    displayName?: string;
    status?: "ACTIVE" | "SUSPENDED" | "EXPIRED";
  } = {},
) {
  licenceSeq++;
  const registrant =
    (holderId && (await db.registrant.findUnique({ where: { userId: holderId } }))) ||
    (firmId && (await db.registrant.findUnique({ where: { firmId } }))) ||
    (await db.registrant.create({
      data: {
        kind: firmId ? "FIRM" : "PERSON",
        registrationNo: `${firmId ? "RF" : "RP"}-T${licenceSeq}`,
        userId: firmId ? null : holderId,
        firmId,
        displayName,
      },
    }));
  const licence = await db.licence.create({
    data: {
      licenceNo: `TST-${category.slice(0, 3)}-${licenceSeq}`,
      registrantId: registrant.id,
      holderId,
      firmId,
      category,
      status,
      displayName,
      issuedAt: new Date(`${issuedAt}T00:00:00Z`),
      expiresAt: new Date(`${expiresAt}T00:00:00Z`),
      affiliatedFirmId,
      qrToken: `qr-${licenceSeq}-${Date.now()}`,
    },
  });
  await projectLicence(licence.id);
  return licence;
}

/** A licensed firm with an active Principal Broker and a Broker who can supervise. */
export async function makeFirmWithPeople() {
  await db.adminDivision.createMany({
    data: [
      { code: "1", level: 1, name: "Kigali City", parentCode: null },
      { code: "12", level: 2, name: "Gasabo", parentCode: "1" },
      { code: "1208", level: 3, name: "Kimihurura", parentCode: "12" },
    ],
    skipDuplicates: true,
  });
  const owner = await makeUser(["APPLICANT", "FIRM_ADMIN"], {
    accountType: "ORGANISATION",
    fullName: "Test Realty Ltd",
  });
  const firm = await db.firm.create({
    data: {
      legalName: "Test Realty Ltd",
      companyRegNo: `RDB-T${Date.now()}`,
      status: "ACTIVE",
      district: "12",
      ownerId: owner.user.id,
    },
  });
  const principal = await makeUser(["APPLICANT", "PRINCIPAL_BROKER", "SUPERVISOR"], {
    fullName: "Grace Principal",
  });
  await makeLicence(principal.user.id, "BROKER", {
    affiliatedFirmId: firm.id,
    displayName: "Grace Principal",
  });
  const pb = await makeLicence(principal.user.id, "PRINCIPAL_BROKER", {
    affiliatedFirmId: firm.id,
    displayName: "Grace Principal",
  });
  await db.firm.update({ where: { id: firm.id }, data: { principalLicenceId: pb.id } });
  const supervisor = await makeUser(["APPLICANT", "SUPERVISOR"], { fullName: "Eric Supervisor" });
  const supervisorLicence = await makeLicence(supervisor.user.id, "BROKER", {
    affiliatedFirmId: firm.id,
    displayName: "Eric Supervisor",
  });
  return { owner, firm, principal, pb, supervisor, supervisorLicence };
}

export { EICAR, pdfOf, pngOf } from "./files";
