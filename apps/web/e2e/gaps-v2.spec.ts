import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { db, latestCode } from "./db";
import { settle } from "./settle";

/** Regression tests for docs/UI_GAP_ANALYSIS_V2.md. */
const PASSWORD = "Rebp-Demo-Pilot-2026";

test.afterAll(async () => {
  await db.$disconnect();
});

async function pasteInto(page: Page, label: string | RegExp, text: string) {
  await page.getByLabel(label).evaluate((input, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    input.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

async function signInAdminByPaste(page: Page) {
  await db.user.update({
    where: { email: "admin@demo.rebp.rw" },
    data: { mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("admin@demo.rebp.rw");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\/two-step/);
  const code = await latestCode("admin@demo.rebp.rw", "mfaLoginCode");
  // W-04: a pasted full code submits on its own — no "Verify" tap.
  await pasteInto(page, "Verification code", code);
  await expect(page).toHaveURL(/\/backoffice$/); // Staff land in the back office (ADR-011).
}

test("I-01: scrolling past the language links never switches the language", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); // give the router time to prefetch visible links
  await page.goto("/categories");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Professional categories");
});

test("W-06: the audit trail is a filterable, readable timeline", async ({ page }) => {
  await signInAdminByPaste(page);
  await page.goto("/backoffice/audit");
  await expect(page.getByRole("heading", { level: 2, name: "Chain intact" })).toBeVisible();
  await expect(page.getByText("Signed in").first()).toBeVisible();

  await page.getByRole("link", { name: "Two-step" }).click();
  await expect(page).toHaveURL(/category=twoStep/);
  await expect(page.getByRole("link", { name: "Two-step" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await page.getByRole("link", { name: "Sign-in" }).click();
  await expect(page).toHaveURL(/category=signin/);
  await expect(page.getByRole("link", { name: "Sign-in" })).toHaveAttribute("aria-current", "true");
  const first = page.locator("details").first();
  await first.locator("summary").click();
  await expect(first.getByText("auth.", { exact: false })).toBeVisible();

  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("W-05: security settings lead with a protection summary", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("applicant@demo.rebp.rw");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/settings/security");
  const summary = page.getByRole("region", { name: /protected|Almost there|At risk/ });
  await expect(summary.getByRole("img", { name: /of 4 protections on/ })).toBeVisible();
  await summary.getByRole("link", { name: /Two-step verification/ }).click();
  await expect(page).toHaveURL(/#two-step$/);
  await settle(page);
  const results = await new AxeBuilder({ page }).withRules(["heading-order"]).analyze();
  expect(results.violations).toEqual([]);
});

test("W-01: the password checklist ticks while typing", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Password", { exact: true }).fill("short");
  const checklist = page.getByRole("list").filter({ hasText: "Passwords match" });
  await expect(checklist.getByText("Not yet").first()).toBeAttached();
  await page.getByLabel("Password", { exact: true }).fill("sunny-kigali-hills-at-dawn");
  await page.getByLabel("Confirm password").fill("sunny-kigali-hills-at-dawn");
  await expect(checklist.getByText("Not yet")).toHaveCount(0);
});

for (const path of ["/privacy", "/forbidden", "/no-such-page"]) {
  test(`A-01: ${path} has one h1 and no accessibility findings`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await settle(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
    ).toEqual([]);
  });
}

test("how it works follows scroll and links each step into the portal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const steps = page.getByRole("list", { name: "How it works" }).getByRole("listitem");
  await expect(steps).toHaveCount(4);
  await expect(steps.first()).toHaveAttribute("aria-current", "step");
  await expect(steps.first().getByRole("link", { name: "Create account" })).toHaveAttribute(
    "href",
    "/sign-up",
  );

  // Scrolling the last step to mid-screen makes it active and switches the phone.
  await steps.nth(3).evaluate((el) => {
    const box = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + box.top + box.height / 2 - window.innerHeight / 2);
  });
  await expect(steps.nth(3)).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-step]")).toHaveAttribute("data-step", "license");

  // Nothing plays on its own: the selection stays put without scrolling.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(3000);
  await expect(steps.nth(3)).toHaveAttribute("aria-current", "step");
});
