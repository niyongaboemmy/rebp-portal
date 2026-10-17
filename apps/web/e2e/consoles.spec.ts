import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "./db";
import { settle } from "./settle";

/**
 * Every screen added for the licensing loop renders for its role without errors and without
 * serious accessibility violations (UX-002, Plan WP-5.3), on desktop and in dark mode.
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";

const SCREENS: Array<{ email: string; paths: string[] }> = [
  {
    email: "applicant@demo.rebp.rw",
    paths: ["/applications", "/applications/new", "/licenses", "/dashboard", "/settings/security"],
  },
  { email: "agent@demo.rebp.rw", paths: ["/licenses", "/applications/new?type=RENEWAL"] },
  { email: "principal@demo.rebp.rw", paths: ["/confirmations", "/firm"] },
  {
    email: "officer@demo.rebp.rw",
    paths: ["/backoffice", "/backoffice/queue", "/backoffice/queue?view=all"],
  },
  {
    email: "approver@demo.rebp.rw",
    paths: ["/backoffice/decisions", "/backoffice/register", "/backoffice/configuration"],
  },
  { email: "registrar@demo.rebp.rw", paths: ["/backoffice/register", "/backoffice/reports"] },
  {
    email: "finance@demo.rebp.rw",
    paths: ["/backoffice/finance", "/backoffice/configuration?tab=fees"],
  },
  {
    email: "admin@demo.rebp.rw",
    paths: ["/backoffice/configuration?tab=thresholds", "/backoffice/configuration?tab=flags"],
  },
];

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

test.beforeAll(async () => {
  const staff = SCREENS.map((s) => s.email).filter(
    (e) => !["applicant@demo.rebp.rw", "agent@demo.rebp.rw"].includes(e),
  );
  for (const email of staff)
    await db.user.update({
      where: { email },
      data: { mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
    });
});

test.afterAll(async () => {
  await db.$disconnect();
});

for (const { email, paths } of SCREENS) {
  test(`screens for ${email.split("@")[0]} render accessibly`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page, email);
    for (const path of paths) {
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expect(page.getByText("Something went wrong")).toHaveCount(0);
        await settle(page);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .exclude("[data-sonner-toaster]")
          .analyze();
        const serious = result.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        expect(serious.map((v) => `${path} [${scheme}] ${v.id}: ${v.nodes[0]?.target}`)).toEqual(
          [],
        );
      }
    }
    expect(errors).toEqual([]);
  });
}

test("portal and back-office pages never scroll sideways on a phone (UX-001)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 760 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await signIn(page, "applicant@demo.rebp.rw");
  for (const path of ["/applications", "/applications/new", "/licenses", "/dashboard"]) {
    await page.goto(path);
    await settle(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await context.close();
});
