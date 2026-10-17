import { expect, test, type Locator, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { db } from "./db";
import { completeProfile } from "./profile";

/**
 * The applicant's CV (UX-018): education, training and experience are entered once on the
 * profile and every application starts with them; what's typed in an application goes back to
 * the CV.
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";
let email = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  email = `cv.${Date.now()}@e2e.rebp.rw`;
  await db.user.create({
    data: {
      email,
      fullName: "Claudine Mukeshimana",
      phone: `+25079${String(Date.now()).slice(-7)}`,
      roles: ["APPLICANT"],
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      profile: completeProfile(email, "Claudine Mukeshimana"),
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

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

async function choose(page: Page, trigger: Locator, option: string) {
  await trigger.click();
  await page.getByRole("menuitem", { name: option, exact: true }).click();
  await expect(trigger).toContainText(option);
}

test("the CV is built on the profile and previewed as it's typed", async ({ page }) => {
  await signIn(page);
  // It's one of the account's tabs, and on the dashboard's setup list.
  await expect(page.getByRole("link", { name: /Build your CV/ })).toBeVisible();
  await page.goto("/settings/cv");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Your CV" })).toBeVisible();
  const parts = page.getByRole("list", { name: "Parts of your CV" });
  await expect(parts.getByRole("button")).toHaveCount(3);

  // Education: the highest level, then a qualification in its dialog.
  await choose(page, page.getByLabel("Highest level of education"), "A2 or equivalent");
  await page.getByRole("button", { name: "Add a qualification" }).click();
  const dialog = page.getByRole("dialog", { name: /New qualification/ });
  await dialog.getByRole("textbox", { name: "Institution" }).fill("GS Kimironko");
  await dialog.getByRole("textbox", { name: "Qualification obtained" }).fill("A2 certificate");
  await choose(page, dialog.getByLabel("Field of study", { exact: true }), "General secondary");
  await dialog.getByLabel("Year completed").fill("2016");
  await dialog
    .getByRole("radiogroup", { name: /outside Rwanda/ })
    .getByText("No", { exact: true })
    .click();
  // The CV keeps no relied-upon choice: that's each application's.
  await expect(dialog.getByText("I rely on this qualification for this category")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  // The preview reads like a CV, and the change is saved.
  const preview = page.getByRole("complementary", { name: "Your CV" });
  await expect(preview).toContainText("A2 certificate");
  await expect(preview).toContainText("GS Kimironko");
  await expect(page.getByText("CV updated")).toBeVisible({ timeout: 10_000 });
  await expect(parts.getByRole("button", { name: "Education: complete" })).toBeVisible();
});

test("a new application starts from the CV and says where its answers go", async ({ page }) => {
  await signIn(page);
  await page.goto("/applications/new");
  await page.getByRole("radio", { name: /New registration/ }).click();
  await page.getByRole("radio", { name: /Real Estate Referral Agent/ }).click();
  await page.getByRole("button", { name: "Start application" }).click();
  await page.waitForURL(/\/wizard/);
  await page.goto(`${new URL(page.url()).pathname}?step=c`);
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);

  // A summary to confirm, not a form (UX-021); the CV is one tap away.
  await expect(page.getByRole("heading", { name: "From your CV" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit in CV" })).toHaveAttribute(
    "href",
    /\/settings\/cv\?part=c/,
  );
  await expect(page.getByLabel("Institution")).toHaveCount(0);
  // The qualification is already there, relied upon for this application.
  const relied = page.getByRole("checkbox", { name: /A2 certificate/ });
  await expect(relied).toHaveAttribute("aria-checked", "true");
});

test("applying waits for the CV parts the category needs", async ({ page }) => {
  await signIn(page);
  await page.goto("/applications/new");
  await page.getByRole("radio", { name: /New registration/ }).click();
  await page.getByRole("radio", { name: /Real Estate Agent/ }).click();
  // Education is ready; training and experience aren't: the CV comes first.
  const cv = page.locator("[data-cv-ready]");
  await expect(cv).toHaveAttribute("data-cv-ready", "false");
  await expect(cv).toContainText("Training & exams");
  await expect(page.getByRole("button", { name: "Start application" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Complete your CV" })).toHaveAttribute(
    "href",
    /\/settings\/cv\?part=d/,
  );
});
