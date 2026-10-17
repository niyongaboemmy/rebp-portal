import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hash } from "@node-rs/argon2";
import { db } from "./db";
import { completeProfile } from "./profile";
import { settle } from "./settle";

/**
 * RBAC console journeys. The admin signs in with email two-step, reading the simulated code from
 * the dev-mode UI. Test people are created per run so demo accounts stay untouched.
 */
const ADMIN = "admin@demo.rebp.rw";
const DEMO_PASSWORD = "Rebp-Demo-Pilot-2026";

async function signInWithEmailCode(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\/two-step/);
  await page.getByRole("button", { name: "Use code" }).click();
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/(dashboard|backoffice)$/);
}

async function createPerson(fullName: string) {
  const email = `${fullName.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@e2e.rebp.rw`;
  await db.user.create({
    data: {
      email,
      profile: completeProfile(email, fullName),
      profileUpdatedAt: new Date(),
      fullName,
      roles: ["APPLICANT"],
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      passwordHash: await hash(DEMO_PASSWORD, {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
    },
  });
  return email;
}

test.beforeAll(async () => {
  // Admins use email two-step for these tests; start from the default permission matrix.
  await db.user.update({
    where: { email: ADMIN },
    data: { mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
  });
  await db.user.update({
    where: { email: "auditor@demo.rebp.rw" },
    data: { mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
  });
  await db.rolePermission.deleteMany({});
});

test.afterAll(async () => {
  await db.rolePermission.deleteMany({});
  await db.$disconnect();
});

/** Opens a person's sheet once the streamed list has replaced its placeholder (one row each). */
async function openPerson(page: Page, email: string) {
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  const row = page.getByTestId(`person-${email}`);
  await expect(row).toHaveCount(1);
  await row.click();
}

test("admin finds a person, previews the impact and changes their roles", async ({ page }) => {
  const email = await createPerson("Rbac Tester");
  await signInWithEmailCode(page, ADMIN);

  // Staff switch areas from the sidebar header (ADR-011).
  await page.getByRole("button", { name: /^Switch area/ }).click();
  await page.getByRole("menuitem", { name: /Back office/ }).click();
  await page.getByRole("link", { name: "Access control" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Access control" })).toBeVisible();

  // Search is debounced and mirrored in the URL; emails are unique per run.
  await page.getByLabel("Search by name or email").fill(email);
  await expect(page.getByTestId("people-count")).toHaveText("1 person");
  await expect(page).toHaveURL(/q=rbac\.tester/);
  await page.getByTestId(`person-${email}`).click();

  const sheet = page.getByTestId("manage-access");
  await expect(sheet.getByText("Rbac Tester")).toBeVisible();
  await sheet.getByTestId("role-toggle-SUPERVISOR").click();
  await expect(sheet.getByTestId("role-toggle-SUPERVISOR")).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByTestId("capability-preview").locator('[data-state="gained"]')).toHaveText(
    ["Confirm supervision"],
  );

  // Adding a staff role surfaces the MFA warning before saving.
  await sheet.getByTestId("role-toggle-REGISTRAR").click();
  await expect(sheet.getByTestId("role-warnings")).toContainText("two-step verification");
  await sheet.getByTestId("role-toggle-REGISTRAR").click();

  await sheet.getByRole("button", { name: "Save roles" }).click();
  await expect(page.getByText("Roles updated for Rbac Tester.")).toBeVisible();
  await expect(page.getByTestId(`person-${email}`).getByText("Supervisor")).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { email } })).roles).toEqual([
    "APPLICANT",
    "SUPERVISOR",
  ]);
});

test("admin cannot edit their own access", async ({ page }) => {
  await signInWithEmailCode(page, ADMIN);
  await page.goto("/backoffice/access?q=admin%40demo");
  await openPerson(page, ADMIN);
  const sheet = page.getByTestId("manage-access");
  await expect(sheet.getByText("You can't change your own access.")).toBeVisible();
  await expect(sheet.getByTestId("role-toggle-AUDITOR")).toBeDisabled();
});

test("disabling an account signs the person out and blocks sign-in", async ({ page, browser }) => {
  const email = await createPerson("Leaver Person");
  // The person is signed in elsewhere.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/sign-in");
  await otherPage.getByLabel("Email address").fill(email);
  await otherPage.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await otherPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(otherPage).toHaveURL(/\/(dashboard|backoffice)$/);

  await signInWithEmailCode(page, ADMIN);
  await page.goto(`/backoffice/access?q=${encodeURIComponent(email)}`);
  await openPerson(page, email);
  const sheet = page.getByTestId("manage-access");
  await sheet.getByLabel("Reason (optional)").fill("Left the firm");
  await sheet.getByRole("button", { name: "Disable account" }).click();
  await expect(
    page.getByText("Leaver Person has been disabled and signed out everywhere."),
  ).toBeVisible();
  await expect(page.getByTestId(`person-${email}`).getByText("Disabled")).toBeVisible();

  // Their open session is gone…
  await otherPage.goto("/dashboard");
  await expect(otherPage).toHaveURL(/\/sign-in/);
  // …and they cannot sign back in.
  await otherPage.getByLabel("Email address").fill(email);
  await otherPage.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await otherPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(otherPage.getByText("This account has been disabled.")).toBeVisible();
  await other.close();

  // Re-enable restores access.
  await page.getByTestId(`person-${email}`).click();
  await page
    .getByTestId("manage-access")
    .getByRole("button", { name: "Re-enable account" })
    .click();
  await expect(page.getByText("Leaver Person can sign in again.")).toBeVisible();
});

test("admin edits the permission matrix; guard-rails block unsafe changes", async ({ page }) => {
  await signInWithEmailCode(page, ADMIN);
  await page.goto("/backoffice/access?tab=roles");
  // The matrix streams in: wait until React has replaced its placeholder copy.
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  const matrix = page.getByTestId("permission-matrix");
  await expect(matrix).toBeVisible();

  // Unsafe: give Reviewing Officers the decision power → review shows the violation, Save disabled.
  await matrix.getByTestId("cell-REVIEWING_OFFICER-decision.make").click();
  await expect(page.getByTestId("matrix-change-count")).toHaveText("1 unsaved change");
  await page.getByRole("button", { name: "Review & save" }).click();
  await expect(page.getByTestId("matrix-violations")).toContainText("can't both review and decide");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Discard" }).click();

  // Locked cells don't toggle.
  await matrix.getByTestId("cell-SYSTEM_ADMIN-roles.manage").click({ force: true });
  await expect(page.getByTestId("matrix-change-count")).toBeHidden();

  // Safe: let Registrars export the audit trail.
  const cell = matrix.getByTestId("cell-REGISTRAR-audit.export");
  await expect(cell).toHaveAttribute("aria-checked", "false");
  await cell.click();
  await page.getByRole("button", { name: "Review & save" }).click();
  await expect(page.getByTestId("matrix-review")).toContainText("Export audit trail");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("1 permission updated")).toBeVisible();
  await expect(matrix.getByTestId("cell-REGISTRAR-audit.export")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(await db.rolePermission.findMany()).toMatchObject([
    { role: "REGISTRAR", capability: "audit.export", granted: true },
  ]);

  // Back to defaults.
  await page.getByRole("button", { name: "Reset to defaults" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset to defaults" }).click();
  await expect(page.getByText("Permissions restored to defaults.")).toBeVisible();
  expect(await db.rolePermission.count()).toBe(0);
});

test("auditors get a read-only view", async ({ page }) => {
  await signInWithEmailCode(page, "auditor@demo.rebp.rw");
  await page.goto("/backoffice/access?tab=roles");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  await expect(
    page.getByText("Read-only: your role can view access but not change it."),
  ).toBeVisible();
  const cell = page.getByTestId("cell-REGISTRAR-audit.export");
  await expect(cell).toHaveAttribute("aria-disabled", "true");
  await cell.click({ force: true });
  await expect(page.getByTestId("matrix-change-count")).toBeHidden();
});

test("applicants have no My access page and cannot open the console", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("applicant@demo.rebp.rw");
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // My access is staff-only: not offered in the account menu, and the page itself is refused.
  await page.getByRole("button", { name: /^Account, / }).click();
  await expect(page.getByRole("menuitem", { name: "Security" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "My access" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/settings/access");
  await expect(page).toHaveURL(/\/forbidden$/);

  await page.goto("/backoffice/access");
  await expect(page).toHaveURL(/\/forbidden$/);
});

test("access pages have no serious accessibility violations (UX-002)", async ({ page }) => {
  await signInWithEmailCode(page, ADMIN);
  for (const path of ["/backoffice/access", "/backoffice/access?tab=roles", "/settings/access"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await settle(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  }
});
