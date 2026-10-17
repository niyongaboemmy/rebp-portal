import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { db } from "./db";
import { completeProfile, sampleCv } from "./profile";

/**
 * UX-016: the Experience step guides the applicant to close an experience gap (BR-020): the coach
 * spells out what's left and adds a period that counts in one tap, "Fix this" always lands
 * somewhere (even on an empty list), and a period that doesn't count says why.
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";
let email = "";

test.beforeAll(async () => {
  // A fresh applicant with nothing on the register and a short CV.
  email = `coach.${Date.now()}@e2e.rebp.rw`;
  await db.user.create({
    data: {
      email,
      fullName: "Aline Uwase",
      phone: `+25078${String(Date.now()).slice(-7)}`,
      roles: ["APPLICANT"],
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      profile: completeProfile(email, "Aline Uwase"),
      // Ready to apply, but with six months of FSLA practice: REA needs three years.
      cv: {
        ...sampleCv(),
        e: {
          ...sampleCv().e,
          records: [
            {
              id: "cv-short",
              firm: "Umuhuza Agency",
              category: "FSLA",
              from: "2026-04-01",
              current: true,
              duties: "Viewings.",
            },
          ],
        },
      },
      profileUpdatedAt: new Date(),
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

test("the experience coach adds a qualifying period and shows when the requirement is met", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto("/applications/new");
  await page.getByRole("radio", { name: /New registration/ }).click();
  await page.getByRole("radio", { name: /Real Estate Agent/ }).click();
  await page.getByRole("button", { name: "Start application" }).click();
  await page.waitForURL(/\/wizard/);
  await page.goto(`${new URL(page.url()).pathname}?step=e`);
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);

  // The gap is spelled out, with the ways to close it.
  // The gap and what counts, as pills (UX-020); the experience itself comes from the CV (UX-021).
  await expect(page.getByRole("heading", { name: "From your CV" })).toBeVisible();
  await expect(page.getByText(/ to go$/).first()).toBeVisible();
  await expect(page.getByText("FSLA counts", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Recognised equivalent experience/ }),
  ).toBeVisible();

  // One tap opens the CV with a new FSLA period, cursor in its first answer.
  await page.getByRole("button", { name: /Add a period of FSLA practice/ }).click();
  await page.waitForURL(/\/settings\/cv\?/);
  const dialog = page.getByRole("dialog", { name: /New period of practice/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Category held")).toContainText("FSLA");
  await dialog.locator('[data-path$=".firm"] input').fill("Kigali Homes Ltd");
  await dialog.locator('[data-path$=".from"] input').fill("2020-01-01");
  await dialog.locator('[data-path$=".to"] input').fill("2023-06-30");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("CV updated")).toBeVisible({ timeout: 10_000 });

  // A new period closed untouched is dropped.
  await page.getByRole("button", { name: "Add a period", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-item]")).toHaveCount(2);

  // Back in the application, the requirement is met.
  await page.getByRole("link", { name: "Back to application" }).click();
  await page.waitForURL(/\/wizard\?step=e/);
  await expect(page.getByText("REA requirement met", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});
