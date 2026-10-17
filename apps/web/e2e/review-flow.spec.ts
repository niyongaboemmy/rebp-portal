import { createCipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { config } from "dotenv";
import { pdfOf, pngOf } from "../src/test/files";
import { db } from "./db";
import { completeProfile, sampleCv } from "./profile";
import { settle } from "./settle";

/**
 * The validation process through the UI (FR-BO-001/002, FR-L-001…010, FR-M-001…013, FR-N-001,
 * BR-091): a submitted application is opened from the work queue by the officer, who starts the
 * review, verifies a document, records the six checks, recommends approval and signs; the approver
 * decides and signs; the licence is issued and the applicant has been told at each step. Then the
 * system administrator (review + decision powers, UX-032) reviews one file and is blocked from
 * deciding it (BR-091) while able to decide another. Files are created directly in the database
 * as a signed, paid and confirmed submission (with encrypted documents, FR-DOC-008).
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";
const OFFICER = "officer@demo.rebp.rw";
const APPROVER = "approver@demo.rebp.rw";
const ADMIN = "admin@demo.rebp.rw";

const testEnv = config({ path: ".env.test", processEnv: {} }).parsed ?? {};
const STORAGE = path.resolve(testEnv.STORAGE_DIR ?? "./var/storage");
const BLOB_KEY = Buffer.from(
  hkdfSync("sha256", testEnv.APP_ENCRYPTION_KEY ?? "", "rebp-blobs", "documents-v1", 32),
);

/** Same format as server/storage/blob-store.ts: "RB1" ‖ IV ‖ tag ‖ AES-256-GCM ciphertext. */
async function storeBlob(data: Buffer): Promise<string> {
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(
    18,
  )
    .toString("base64url")
    .replace(/[^a-z0-9]/gi, "x")}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", BLOB_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const file = path.join(STORAGE, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.concat([Buffer.from("RB1"), iv, cipher.getAuthTag(), ciphertext]), {
    mode: 0o600,
  });
  return key;
}

/** REBP-{YYYY}-NEW-{SEQ6}-{CHK} with the Luhn check digit of @rebp/contracts (FR-A-001). */
async function nextReference(): Promise<string> {
  const [row] = await db.$queryRawUnsafe<Array<{ value: bigint }>>(
    "SELECT nextval('application_ref_seq') AS value",
  );
  const year = new Date().getUTCFullYear();
  const serial = String(Number(row!.value)).padStart(6, "0");
  const digits = `${year}${serial}`;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return `REBP-${year}-NEW-${serial}-${(10 - (sum % 10)) % 10}`;
}

const DOCUMENTS = [
  "photo",
  "proofOfIdentity",
  "educationCertificate",
  "trainingCertificate",
  "criminalRecord",
  "affiliationEvidence",
] as const;

/**
 * A signed, paid and confirmed FSLA application at Keza Realty under Eric Mugisha
 * (BRK-2022-00104), unassigned in SUBMITTED — or, with `signedBy`, already reviewed and signed by
 * that officer and waiting in PENDING_DECISION.
 */
async function submittedApplication(fullName: string, signedBy?: string) {
  const email = `review.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.rebp.rw`;
  const phone = `+25078${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  const applicant = await db.user.create({
    data: {
      email,
      fullName,
      phone,
      profile: completeProfile(email, fullName, phone),
      cv: sampleCv(),
      profileUpdatedAt: new Date(),
      roles: ["APPLICANT"],
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      passwordHash: await hash(PASSWORD, {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
    },
  });
  const firm = await db.firm.findFirstOrThrow({ where: { legalName: "Keza Realty Ltd" } });
  const [givenNames, ...rest] = fullName.split(" ");
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);
  const data = {
    b: {
      surname: rest.join(" "),
      givenNames,
      idType: "NATIONAL_ID",
      idNumber: `11990${String(now).slice(-11)}`,
      dateOfBirth: "1990-01-15",
      nationality: ["RW"],
      phone: "0788123456",
      email,
      residentialAddress: { province: "1", district: "12", sector: "1208" },
      professionalSameAsResidential: true,
      occupation: "Sales agent",
    },
    c: {
      highestLevel: "A2",
      qualifications: [
        {
          id: "q1",
          institution: "GS Kigali",
          qualification: "A2 certificate",
          fieldOfStudy: "GENERAL_SECONDARY",
          yearCompleted: 2016,
          isForeign: false,
          reliedUpon: true,
        },
      ],
    },
    d: {
      trainingCompleted: true,
      trainingProvider: "PBTI",
      trainingProgramme: "ENTRY",
      trainingCompletedOn: "2026-03-01",
      trainingCertificateNo: "PBTI-ENT-123",
      examPassed: "NOT_APPLICABLE",
    },
    f: {
      isAffiliated: true,
      firmId: firm.id,
      supervisorLicenceNo: "BRK-2022-00104",
      affiliationStart: new Date(now).toISOString().slice(0, 10),
    },
    g: { territory: ["12"], restrictionsAck: true },
    h: {
      criminalConviction: false,
      disciplinarySanction: false,
      licenceRevoked: false,
      currentRestriction: false,
      criminalRecordIssuedOn: new Date(now - 10 * 86_400_000).toISOString().slice(0, 10),
      codeOfConduct: true,
    },
  };
  const officer = signedBy ? await db.user.findUniqueOrThrow({ where: { email: signedBy } }) : null;
  const app = await db.application.create({
    data: {
      referenceNo: await nextReference(),
      type: "NEW",
      category: "FSLA",
      status: officer ? "PENDING_DECISION" : "SUBMITTED",
      applicantId: applicant.id,
      data,
      signedAt: at(90),
      submittedAt: at(60),
      slaDueAt: new Date(now + 3 * 86_400_000),
      assignedOfficerId: officer?.id ?? null,
      assignedAt: officer ? at(50) : null,
      createdAt: at(120),
      lastActivityAt: at(60),
      events: {
        create: [
          {
            fromStatus: null,
            toStatus: "DRAFT",
            actorId: applicant.id,
            reason: "created",
            at: at(120),
          },
          {
            fromStatus: "DRAFT",
            toStatus: "SUBMITTED",
            actorId: applicant.id,
            reason: "submitted",
            at: at(60),
          },
          ...(officer
            ? [
                {
                  fromStatus: "SUBMITTED" as const,
                  toStatus: "UNDER_REVIEW" as const,
                  actorId: officer.id,
                  reason: "reviewStarted",
                  at: at(40),
                },
                {
                  fromStatus: "UNDER_REVIEW" as const,
                  toStatus: "PENDING_DECISION" as const,
                  actorId: officer.id,
                  reason: "reviewSigned",
                  at: at(20),
                },
              ]
            : []),
        ],
      },
    },
  });
  for (const type of DOCUMENTS) {
    const bytes = type === "photo" ? pngOf(400, 500) : pdfOf(`${type} ${app.referenceNo}`);
    await db.document.create({
      data: {
        applicationId: app.id,
        type,
        ownerId: applicant.id,
        status: officer ? "VERIFIED" : "CLEAN",
        versions: {
          create: {
            version: 1,
            fileName: type === "photo" ? "photo.png" : `${type}.pdf`,
            mimeType: type === "photo" ? "image/png" : "application/pdf",
            size: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            storageKey: await storeBlob(bytes),
            scanStatus: "CLEAN",
            uploadedById: applicant.id,
          },
        },
      },
    });
  }
  if (officer) {
    const signedAt = at(20);
    await db.review.create({
      data: {
        applicationId: app.id,
        version: 1,
        officerId: officer.id,
        checks: Object.fromEntries(
          ["identity", "education", "experience", "trainingExam", "affiliation", "integrity"].map(
            (k) => [k, { outcome: k === "experience" ? "NA" : "VERIFIED" }],
          ),
        ),
        documentation: "COMPLETE",
        eligibility: "SATISFIED",
        recommendation: "APPROVE",
        computed: {
          documentation: "COMPLETE",
          eligibility: "SATISFIED",
          overridden: { documentation: false, eligibility: false },
        },
        signedAt,
        signature: {
          officerId: officer.id,
          name: officer.fullName,
          method: "PASSWORD_REAUTH",
          at: signedAt.toISOString(),
        },
      },
    });
  }
  return { applicant, app };
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(dashboard|sign-in\/two-step)/);
  if (page.url().includes("two-step")) {
    await page.getByRole("button", { name: "Use code" }).click();
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL(/\/dashboard/);
  }
}

/** Streaming pages park their content in a hidden segment first; wait until it's revealed. */
async function revealed(page: Page) {
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
}

/** Section L in the console: take the file, start, verify a document, six checks, approve, sign. */
async function reviewAndSign(page: Page, applicationId: string) {
  await revealed(page);
  // Wait for the console to render one of its two first actions before choosing.
  const assignToMe = page.getByRole("button", { name: "Assign to me" });
  await expect(assignToMe.or(page.getByRole("button", { name: "Start review" }))).toBeVisible();
  if (await assignToMe.isVisible()) await assignToMe.click();
  await page.getByRole("button", { name: "Start review" }).click();
  await expect
    .poll(
      async () => (await db.application.findUniqueOrThrow({ where: { id: applicationId } })).status,
      { timeout: 15_000 },
    )
    .toBe("UNDER_REVIEW");

  // FR-L-011: open the first document in the carousel and verify it there.
  await page.locator("[data-testid^=viewer-doc-]").first().click();
  await page.getByTestId("document-carousel").getByTestId("verify-document").click();
  await expect(page.getByText("Document verified.")).toBeVisible();
  await page.keyboard.press("Escape");
  // The checks are on the Review tab (UX-036).
  await page.getByRole("tab", { name: /Review/ }).click();
  await expect
    .poll(() => db.document.count({ where: { applicationId, status: "VERIFIED" } }))
    .toBeGreaterThan(0);

  // Section L: the six verification items (FSLA needs no experience → not applicable).
  for (const item of ["identity", "education", "trainingExam", "affiliation", "integrity"])
    await page.getByTestId(`check-${item}-VERIFIED`).click();
  await page.getByTestId("check-experience-NA").click();
  await page
    .locator("#review-recommendation")
    .getByRole("button", { name: /^Approve/ })
    .click();
  await settle(page);
  await page.getByRole("button", { name: "Sign review" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign review" }).click();
  await expect
    .poll(
      async () => (await db.application.findUniqueOrThrow({ where: { id: applicationId } })).status,
      { timeout: 15_000 },
    )
    .toBe("PENDING_DECISION");
}

/** Section M: approve, then confirm the signature in the modal. */
async function approveAndSign(page: Page) {
  await revealed(page);
  await page.getByTestId("decision-APPROVED").check();
  await page.getByTestId("sign-decision").click();
  await page.getByTestId("confirm-sign-decision").click();
  await expect(page.getByText("Decision recorded")).toBeVisible({ timeout: 20_000 });
}

test.beforeAll(async () => {
  for (const email of [OFFICER, APPROVER, ADMIN])
    await db.user.update({
      where: { email },
      data: { mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
    });
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe.configure({ mode: "serial" });

test("officer validates from the queue, approver decides, the licence is issued", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { applicant, app } = await submittedApplication("Josiane Uwimana");

  // FR-BO-001: the officer finds the file in the queue (all files, by reference).
  await signIn(page, OFFICER);
  await page.goto(`/backoffice/queue?view=all&q=${encodeURIComponent(app.referenceNo)}`);
  const row = page.getByRole("listitem").filter({ hasText: app.referenceNo });
  await expect(row.getByTestId("queue-in-state")).toBeVisible();
  await row.getByRole("link", { name: new RegExp(app.referenceNo) }).click();
  await page.waitForURL(/\/backoffice\/review\//);
  await reviewAndSign(page, app.id);
  expect(
    (await db.application.findUniqueOrThrow({ where: { id: app.id } })).assignedOfficerId,
  ).toBe((await db.user.findUniqueOrThrow({ where: { email: OFFICER } })).id);

  // Section M by a different person (BR-091).
  await signIn(page, APPROVER);
  await page.goto(`/backoffice/decisions/${app.id}`);
  await expect(page.getByTestId("br091-banner")).toHaveCount(0);
  await approveAndSign(page);
  await expect(page.getByTestId("issued-licence")).toBeVisible();

  const licence = await db.licence.findFirstOrThrow({ where: { applicationId: app.id } });
  expect(licence.status).toBe("ACTIVE");
  expect((await db.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe(
    "LICENSE_ISSUED",
  );
  await expect(page.getByTestId("issued-licence")).toHaveText(licence.licenceNo);

  // The applicant was told at each step (N-011 review started / complete, N-060 approved).
  const keys = (
    await db.notification.findMany({
      where: { userId: applicant.id },
      select: { messageKey: true },
    })
  ).map((n) => n.messageKey);
  expect(keys).toEqual(expect.arrayContaining(["reviewStarted", "reviewComplete", "approved"]));
});

test("the administrator reviews one file and can't decide it, but decides another (BR-091)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { app: reviewed } = await submittedApplication("Clarisse Mukeshimana");
  const { applicant: other, app: waiting } = await submittedApplication("Didier Habimana", OFFICER);

  await signIn(page, ADMIN);
  await page.goto(`/backoffice/review/${reviewed.id}`);
  await reviewAndSign(page, reviewed.id);

  // BR-091: whoever reviewed (or was assigned) a file may never decide it.
  await page.goto(`/backoffice/decisions/${reviewed.id}`);
  await revealed(page);
  await expect(page.getByTestId("br091-banner")).toBeVisible();
  await expect(page.getByTestId("br091-banner")).toContainText(/review/i);
  await expect(page.getByTestId("sign-decision")).toBeDisabled();

  // A file someone else reviewed: the administrator decides it.
  await page.goto(`/backoffice/decisions/${waiting.id}`);
  await expect(page.getByTestId("br091-banner")).toHaveCount(0);
  await approveAndSign(page);
  const licence = await db.licence.findFirstOrThrow({ where: { applicationId: waiting.id } });
  expect(licence.status).toBe("ACTIVE");
  expect(await db.notification.count({ where: { userId: other.id, messageKey: "approved" } })).toBe(
    1,
  );
  expect((await db.application.findUniqueOrThrow({ where: { id: reviewed.id } })).status).toBe(
    "PENDING_DECISION",
  );
});
