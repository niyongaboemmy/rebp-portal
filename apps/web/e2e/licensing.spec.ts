import { crc32, deflateSync } from "node:zlib";
import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hash } from "@node-rs/argon2";
import { db } from "./db";
import { completeProfile, sampleCv } from "./profile";
import { settle } from "./settle";

/**
 * The end-to-end licensing loop through the UI (Plan O1, WP-3.10, SRS §19.2): a new FSLA applicant
 * drafts, uploads, signs and pays; the supervisor and the firm's Principal Broker confirm; the
 * officer reviews and signs; the approver (a different person, BR-091) decides; the licence appears
 * on the public register and verifies by number. Staff use email two-step with the dev-mode code.
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";

const STAFF = ["officer@demo.rebp.rw", "approver@demo.rebp.rw", "principal@demo.rebp.rw"];

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** A real 600 × 600 PNG: the photo is embedded in the certificate. */
function photo(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(600, 0);
  header.writeUInt32BE(600, 4);
  header[8] = 8;
  const row = Buffer.alloc(601, 180);
  row[0] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: 600 }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pdf = (label: string) =>
  Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n% ${label}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
  );

async function upload(
  page: Page,
  type: string,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await reveal(page, page.locator(`[data-document-type="${type}"]`));
  await page.locator(`[data-document-type="${type}"] input[type=file]`).first().setInputFiles(file);
  // The row's status (its hover card may repeat it while the pointer rests there).
  await expect(
    page.locator(`[data-document-type="${type}"]`).getByText("Uploaded").first(),
  ).toBeVisible();
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(dashboard|backoffice|sign-in\/two-step)/);
  if (page.url().includes("two-step")) {
    await page.getByRole("button", { name: "Use code" }).click();
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL(/\/(dashboard|backoffice)/);
  }
}

async function yes(page: Page, question: RegExp, answer: "Yes" | "No") {
  const group = await reveal(page, page.getByRole("radiogroup", { name: question }));
  await group.getByText(answer, { exact: true }).click();
}

/** Long sections are paged: open the page that holds this field (via the page chips). */
async function reveal(page: Page, target: Locator): Promise<Locator> {
  if (await target.first().isVisible()) return target;
  const chips = page.getByRole("list", { name: "Pages of this step" }).getByRole("button");
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    await chips.nth(i).click();
    const shown = await target
      .first()
      .waitFor({ state: "visible", timeout: 600 })
      .then(() => true)
      .catch(() => false);
    if (shown) return target;
  }
  return target;
}

/** Finish the step: turn its remaining pages, then save and continue. */
async function next(page: Page) {
  const finish = page.getByRole("button", { name: "Save and continue" });
  for (let i = 0; i < 8 && !(await finish.isVisible()); i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await finish.click();
}

/**
 * A page that streams after its layout is first parked in a hidden segment (`<div hidden
 * id="S:…">`) while React reveals it, so for a moment the form exists twice. Wait until it's
 * revealed before acting, so locators see one copy.
 */
async function revealed(page: Page) {
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
}

let applicantEmail = "";

test.beforeAll(async () => {
  for (const email of STAFF)
    await db.user.update({
      where: { email },
      data: { mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
    });
  applicantEmail = `fsla.${Date.now()}@e2e.rebp.rw`;
  await db.user.create({
    data: {
      email: applicantEmail,
      profile: completeProfile(applicantEmail, "Aline Mukamana"),
      cv: sampleCv(),
      profileUpdatedAt: new Date(),
      fullName: "Aline Mukamana",
      phone: `+25078${String(Date.now()).slice(-7)}`,
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
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe.configure({ mode: "serial" });

let reference = "";

test("applicant drafts, uploads, signs and pays an FSLA application", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, applicantEmail);
  // Identity documents live on the profile (UX-010): uploaded once, copied into applications.
  await page.goto("/settings/profile");
  await page
    .getByRole("list", { name: "Profile steps" })
    .getByRole("button", { name: /^Identity documents/ })
    .click();
  await upload(page, "proofOfIdentity", {
    name: "id.pdf",
    mimeType: "application/pdf",
    buffer: pdf("id"),
  });
  await upload(page, "photo", { name: "photo.png", mimeType: "image/png", buffer: photo() });
  await expect(page.getByRole("heading", { name: "Your profile is complete" })).toBeVisible();
  await page.goto("/applications/new");
  await page.getByRole("radio", { name: /New registration/ }).click();
  await page.getByRole("radio", { name: /Field Sales and Leasing Agent/ }).click();
  await page.getByRole("button", { name: "Start application" }).click();
  await page.waitForURL(/\/wizard/);
  reference = (await page
    .locator("text=/REBP-\\d{4}-NEW-\\d{6}-\\d/")
    .first()
    .textContent())!.trim();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  // Section B — personal details come from the applicant's profile (UX-010): confirm, upload.
  await expect(page.getByRole("heading", { level: 2, name: "Personal details" })).toBeVisible();
  const summary = page.locator('section[aria-labelledby="from-profile"]');
  await expect(summary.getByRole("heading", { name: "From your profile" })).toBeVisible();
  await expect(summary.getByText("Aline Mukamana")).toBeVisible();
  // The profile's documents are already here, as copies.
  for (const type of ["proofOfIdentity", "photo"])
    await expect(
      (await reveal(page, page.locator(`[data-document-type="${type}"]`)))
        .getByText("Uploaded")
        .first(),
    ).toBeVisible();
  await next(page);

  // Section C — education.
  await expect(page.getByRole("heading", { level: 2, name: "Education" })).toBeVisible();
  // From the CV (UX-021): confirm it, and the qualification this application relies on.
  await expect(page.getByRole("heading", { name: "From your CV" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /A2 certificate/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await upload(page, "educationCertificate", {
    name: "a2.pdf",
    mimeType: "application/pdf",
    buffer: pdf("a2"),
  });
  await next(page);

  // Section D — training (exam not applicable for FSLA).
  await expect(page.getByRole("heading", { level: 2, name: "Training and exams" })).toBeVisible();
  await expect(page.getByText("Entry-level (FSLA)", { exact: false })).toBeVisible();
  await upload(page, "trainingCertificate", {
    name: "training.pdf",
    mimeType: "application/pdf",
    buffer: pdf("training"),
  });
  await next(page);

  // Section F — firm (register typeahead) and supervisor (register lookup, BR-030).
  await expect(page.getByRole("heading", { level: 2, name: "Firm and supervision" })).toBeVisible();
  await (await reveal(page, page.getByRole("combobox"))).fill("Keza");
  // The option is in the lookup's own list: wait for it, don't page-hunt (a chip click would
  // move focus off the search box and close the list).
  await page.getByRole("option", { name: /Keza Realty/ }).click();
  await expect(page.getByText("On the register")).toBeVisible();
  // Asked once the firm is named, in its name; the start date defaults to today (UX-004).
  await yes(page, /already work with Keza Realty/, "Yes");
  // "Today" in Kigali (UTC+2), as the app counts it — not UTC.
  await expect(page.getByLabel("Start of affiliation")).toHaveValue(
    new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10),
  );
  await (await reveal(page, page.getByLabel("Supervisor's licence number"))).fill("BRK-2022-00104");
  await expect(page.getByText("Eric Mugisha")).toBeVisible();
  await upload(page, "affiliationEvidence", {
    name: "letter.pdf",
    mimeType: "application/pdf",
    buffer: pdf("letter"),
  });
  await next(page);

  // Section G2 — territory and restrictions.
  await expect(
    page.getByRole("heading", { level: 2, name: "Category requirements" }),
  ).toBeVisible();
  await (await reveal(page, page.getByRole("button", { name: "Gasabo", exact: true }))).click();
  await (
    await reveal(page, page.getByText("I understand I may not negotiate independently"))
  ).click();
  await next(page);

  // Section H — integrity.
  await expect(page.getByRole("heading", { level: 2, name: "Integrity" })).toBeVisible();
  await yes(page, /convicted of a criminal offence/, "No");
  await yes(page, /disciplinary sanction/, "No");
  await yes(page, /registration or licence revoked/, "No");
  await yes(page, /restriction that may legally prevent/, "No");
  await (
    await reveal(page, page.getByLabel("Date the certificate was issued"))
  ).fill(new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10));
  await yes(page, /code of conduct/, "Yes");
  await upload(page, "criminalRecord", {
    name: "record.pdf",
    mimeType: "application/pdf",
    buffer: pdf("record"),
  });
  await next(page);

  // Section I — checklist complete.
  await expect(page.getByText("All required documents are here")).toBeVisible();
  await next(page);

  // Review, declaration and OTP signature.
  await expect(page.getByText("Ready to sign")).toBeVisible();
  await settle(page);
  // Transient toasts are excluded: their contrast belongs to the shared toast primitive.
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
    [],
  );
  await page.getByText("I confirm that I have read and accepted the declaration.").click();
  await page.getByRole("button", { name: "Send signing code" }).click();
  await page.getByTestId("dev-code").getByRole("button").click();
  await page.getByRole("button", { name: /Sign and submit/ }).click();

  // Payment through the sandbox gateway.
  await page.waitForURL(/\/pay$/);
  await page.getByRole("button", { name: /^Pay RWF/ }).click();
  await page.waitForURL(/\/pay\/PAY-/);
  await page.getByRole("button", { name: "Approve payment" }).click();
  await expect(page.getByText("Payment received")).toBeVisible();
  await page.getByRole("button", { name: "Back to my application" }).click();
  // The end of the process is celebrated, then the status page takes over.
  const celebration = page.getByRole("dialog", { name: "Application submitted!" });
  await expect(celebration).toBeVisible();
  // Its main action continues to the applications list; this one can be followed from here too.
  await expect(
    celebration.getByRole("link", { name: "Continue to my applications" }),
  ).toHaveAttribute("href", "/applications");
  await celebration.getByRole("button", { name: "Track my application" }).click();
  await expect(page).not.toHaveURL(/celebrate=/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Awaiting confirmation" }),
  ).toBeVisible();
});

test("supervisor and Principal Broker confirm", async ({ page }) => {
  for (const email of ["supervisor@demo.rebp.rw", "principal@demo.rebp.rw"]) {
    await signIn(page, email);
    await page.goto("/confirmations");
    const row = page.getByRole("listitem").filter({ hasText: reference });
    await row.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/Confirmed\./)).toBeVisible();
  }
  const app = await db.application.findUniqueOrThrow({ where: { referenceNo: reference } });
  expect(app.status).toBe("SUBMITTED");
});

test("officer reviews and signs; the approver decides; the licence verifies publicly", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const app = await db.application.findUniqueOrThrow({ where: { referenceNo: reference } });

  await signIn(page, "officer@demo.rebp.rw");
  await page.goto("/backoffice/queue");
  await page
    .getByRole("link", { name: new RegExp(reference) })
    .first()
    .click();
  await page.waitForURL(/\/backoffice\/review\//);
  await revealed(page);
  // The next step floats at the bottom right (UX-036): Assign to me, then Start review.
  const assignToMe = page.getByRole("button", { name: "Assign to me" });
  await expect(assignToMe.or(page.getByRole("button", { name: "Start review" }))).toBeVisible();
  if (await assignToMe.isVisible()) await assignToMe.click();
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("tab", { name: /Review/ }).click();
  // Section L: record each verification (FSLA has no experience requirement → not applicable).
  for (const item of ["identity", "education", "trainingExam", "affiliation", "integrity"])
    await page.getByTestId(`check-${item}-VERIFIED`).click();
  await page.getByTestId("check-experience-NA").click();
  await page
    .locator("#review-recommendation")
    .getByRole("button", { name: /^Approve/ })
    .click();
  await page.getByRole("button", { name: "Sign review" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign review" }).click();
  await expect
    .poll(async () => (await db.application.findUniqueOrThrow({ where: { id: app.id } })).status, {
      timeout: 15_000,
    })
    .toBe("PENDING_DECISION");

  await signIn(page, "approver@demo.rebp.rw");
  await page.goto(`/backoffice/decisions/${app.id}`);
  await revealed(page);
  await page.getByTestId("decision-APPROVED").check();
  await page.getByTestId("sign-decision").click();
  await page.getByTestId("confirm-sign-decision").click();
  await expect(page.getByText("Decision recorded")).toBeVisible({ timeout: 20_000 });

  const licence = await db.licence.findFirstOrThrow({ where: { applicationId: app.id } });
  expect(licence.status).toBe("ACTIVE");

  // FR-REG-004: public verification by licence number (and by the QR token).
  await page.context().clearCookies();
  await page.goto(`/check/${licence.licenceNo}`);
  await expect(page.getByRole("heading", { level: 1, name: "Aline Mukamana" })).toBeVisible();
  await expect(page.getByText(licence.licenceNo).first()).toBeVisible();
  await page.goto(`/check/${licence.qrToken}`);
  await expect(page.getByRole("heading", { level: 1, name: "Aline Mukamana" })).toBeVisible();
  // FR-REG-003: no personal data on the public page.
  await expect(page.getByText("1199880012345678")).toHaveCount(0);
  await expect(page.getByText("1998")).toHaveCount(0);
});
