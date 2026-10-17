import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { db } from "./db";
import { completeProfile, sampleCv } from "./profile";

/**
 * Applicant profile (UX-010): personal details are entered once, on the profile, before anything
 * else; every application reuses them, so Section B is a summary to confirm, not a form.
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";
let email = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  email = `profile.${Date.now()}@e2e.rebp.rw`;
  // Everything but the occupation: the profile is one answer short.
  const { occupation: _skip, ...almost } = completeProfile(email, "Divine Uwamahoro");
  await db.user.create({
    data: {
      email,
      fullName: "Divine Uwamahoro",
      phone: `+25072${String(Date.now()).slice(-7)}`,
      roles: ["APPLICANT"],
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      profile: almost,
      cv: sampleCv(),
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

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("signing in with an incomplete profile goes to the profile first", async ({ page }) => {
  await signIn(page);
  await page.waitForURL(/\/settings\/profile\?welcome=1/);
  await expect(
    page.getByRole("heading", { name: "Welcome! Let's set up your profile" }),
  ).toBeVisible();
  // 10 of 13: one answer and both identity documents to go.
  await expect(page.getByRole("img", { name: "Profile 77% complete" })).toBeVisible();

  // Other pages wait until it's complete.
  await page.goto("/applications");
  await page.waitForURL(/\/settings\/profile\?welcome=1/);

  // Steps show where something is missing: the Work step needs one answer.
  const steps = page.getByRole("list", { name: "Profile steps" });
  // The companion acts out the status (UX-012); tapping it jumps to what's missing.
  await page.getByRole("button", { name: /Show what's missing/ }).click();
  await expect(steps.getByRole("button", { name: "Work: 1 missing" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByLabel("Current occupation").fill("Sales agent");
  // Every step has Save changes (autosave also runs after a pause).
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(steps.getByRole("button", { name: "Work: complete" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Profile 85% complete" })).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });
  // Every saved change is confirmed with a notification.
  await expect(page.getByText("Profile updated")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saved" })).toBeDisabled();
  // The details are complete, so the applicant may go on; the documents can follow.
  await steps.getByRole("button", { name: /^Identity documents/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/applications$/);
});

test("an application reuses the profile: Section B is a summary to confirm", async ({ page }) => {
  await signIn(page);
  await page.waitForURL(/\/dashboard/);
  await page.goto("/applications/new");
  await page.getByRole("radio", { name: /New registration/ }).click();
  await page.getByRole("radio", { name: /Real Estate Referral Agent/ }).click();
  await page.getByRole("button", { name: "Start application" }).click();
  await page.waitForURL(/\/wizard/);
  const wizard = new URL(page.url()).pathname;

  await page.goto(`${wizard}?step=b`);
  // A streamed page briefly holds a hidden copy while React reveals it.
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  const summary = page.locator('section[aria-labelledby="from-profile"]');
  await expect(summary.getByRole("heading", { name: "From your profile" })).toBeVisible();
  await expect(summary.getByText("Divine Uwamahoro")).toBeVisible();
  await expect(summary.getByText("Sales agent")).toBeVisible();
  // No form to retype.
  await expect(page.getByLabel("Surname")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit in profile" })).toHaveAttribute(
    "href",
    /\/settings\/profile\?next=/,
  );
});

test("identity documents uploaded on the profile are copied into the application", async ({
  page,
}) => {
  await signIn(page);
  await page.waitForURL(/\/dashboard/);
  await page.goto("/settings/profile");
  await page
    .getByRole("list", { name: "Profile steps" })
    .getByRole("button", { name: /^Identity documents/ })
    .click();
  await page
    .locator('[data-document-type="proofOfIdentity"] input[type=file]')
    .first()
    .setInputFiles({
      name: "id.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  await expect(
    page.locator('[data-document-type="proofOfIdentity"]').getByText("Uploaded"),
  ).toBeVisible({ timeout: 15_000 });

  // The open application gets its copy: shown in step B, managed from the profile.
  const app = await db.application.findFirstOrThrow({
    where: { applicant: { email } },
    orderBy: { createdAt: "desc" },
  });
  await page.goto(`/applications/${app.id}/wizard?step=b`);
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  await page
    .getByRole("list", { name: "Pages of this step" })
    .getByRole("button", { name: /Documents/ })
    .click();
  const slot = page.locator('[data-document-type="proofOfIdentity"]');
  await expect(slot.getByText("Uploaded")).toBeVisible();
  await expect(slot.getByRole("link", { name: "From your profile" })).toBeVisible();
  await expect(slot.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
});
