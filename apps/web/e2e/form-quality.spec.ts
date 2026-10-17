import { mkdirSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { db } from "./db";
import { completeProfile, sampleCv } from "./profile";
import { settle } from "./settle";

/**
 * The guided form (docs/UX_FORM_IMPLEMENTATION_PLAN.md, UX-004 Phase 6): a problem is said once,
 * where it is caused, with how to fix it; pages stay short; status never contradicts itself.
 * Section F for a Real Estate Referral Agent is the reference screen of the inspection (UX-003).
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";
let email = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  email = `rera.${Date.now()}@e2e.rebp.rw`;
  await db.user.create({
    data: {
      email,
      profile: completeProfile(email, "Yvette Ishimwe"),
      cv: sampleCv(),
      profileUpdatedAt: new Date(),
      fullName: "Yvette Ishimwe",
      phone: `+25079${String(Date.now()).slice(-7)}`,
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

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

let wizardUrl = "";

async function openStep(page: Page, step: string) {
  await page.goto(`${wizardUrl}?step=${step}`);
  // A streamed page briefly holds a hidden copy while React reveals it.
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  await settle(page);
}

/** Top-level answers visible on the current page (a lookup's inner field counts once). */
async function visibleFields(page: Page) {
  return page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "section[aria-labelledby=step-title] [data-path]",
        ),
      ].filter((el) => el.offsetParent !== null && !el.parentElement?.closest("[data-path]"))
        .length,
  );
}

test("RERA applicant starts an application", async ({ page }) => {
  await signIn(page);
  await page.goto("/applications/new");
  // Survey format (UX-006): one question per screen, each choice moves on.
  await expect(page.getByRole("radio", { name: /Real Estate Referral Agent/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /New registration/ }).click();
  await expect(page.getByRole("radio", { name: /New registration/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /Real Estate Referral Agent/ }).click();
  await expect(page.getByRole("button", { name: "Change" })).toHaveCount(2);
  // Documents and fees are shown before anything is created (UX-005).
  const before = page.locator("[data-before-start]");
  await expect(before).toContainText("Documents to have ready");
  await expect(before).toContainText("Criminal record certificate");
  await expect(before).toContainText("Total");
  await page.getByRole("button", { name: "Start application" }).click();
  await page.waitForURL(/\/wizard/);
  wizardUrl = new URL(page.url()).pathname;
});

test("Section F says each problem once, at its answer, with the fix", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await openStep(page, "f");
  await expect(page.getByRole("heading", { level: 2, name: "Firm and supervision" })).toBeVisible();

  // Before any answer: no issue block, no contradictory badge.
  await expect(page.locator("[data-issues]")).toHaveCount(0);

  await page.getByText("Through a licensed firm").click();

  await page.getByRole("combobox").fill("Keza");
  await page.getByRole("option", { name: /Keza Realty/ }).click();
  // Asked in the firm's name, once it is known; the start date defaults to today.
  await expect(
    page.getByRole("radiogroup", { name: /already work with Keza Realty/ }),
  ).toBeVisible();
  await page
    .getByRole("radiogroup", { name: /already work with Keza Realty/ })
    .getByText("Yes", { exact: true })
    .click();
  await expect(page.getByLabel("Start of affiliation")).not.toHaveValue("");

  // One topic per page: the supervisor is asked on the next page.
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // An RERA licence can't supervise an RERA (BR-030): one card says who, the verdict and the fix.
  await page.getByLabel("Supervisor's licence number").fill("rra 2025 115");
  await page.getByLabel("Supervisor's licence number").blur();
  await expect(page.getByLabel("Supervisor's licence number")).toHaveValue("RRA-2025-00115");
  const card = page.locator('[data-licence-result="category"]');
  await expect(card).toContainText("Yvonne Uwera");
  await expect(card).toContainText("Can't supervise");
  await expect(card).toContainText(/Name a supervisor who holds one of these licences/);

  // Said once: no rule block under the field, no panel above the form, no self-link.
  await expect(page.getByText(/Name a supervisor who holds one of these licences/)).toHaveCount(1);
  await expect(page.locator('[data-rule-field="f.supervisorLicenceNo"]')).toHaveCount(0);
  await expect(page.locator("[data-issues]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fix in Firm and supervision" })).toHaveCount(0);

  // Status agrees everywhere once the rules run: the step badge and the rail say one thing to fix.
  await expect(page.locator('[data-step-badge="fix"]')).toHaveText("1 to fix", { timeout: 15_000 });
  await expect(page.locator("nav").getByText("1 to fix").first()).toBeVisible();

  // The one-tap fix sits in the card: the firm's Principal Broker can supervise.
  await card.getByRole("button", { name: /Use Grace Ingabire · PBK-2023-00102/ }).click();
  await expect(page.locator('[data-licence-result="ok"]')).toContainText("Can supervise");
  await expect(page.locator('[data-step-badge="done"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-graphic="supervision-chain"]')).toContainText(
    "Your supervisor confirms digitally after you submit.",
  );
});

test("Section F is one topic per page: operate and firm, supervision, uploads", async ({
  page,
}) => {
  await signIn(page);
  await openStep(page, "f");
  const chips = page.getByRole("list", { name: "Pages of this step" }).getByRole("button");
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(1)).toContainText("Supervision");
  await expect(page.getByRole("button", { name: /^1\s*Overview/ })).toHaveCount(0);
});

test("pages stay short across sections (metric for UX-004 Appendix A)", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const report: Record<string, number[]> = {};
  // RERA's sections (stepsFor("NEW", "RERA")); D does not apply to this category.
  for (const step of ["b", "c", "f", "g", "h"]) {
    await openStep(page, step);
    const chips = page.getByRole("list", { name: "Pages of this step" }).getByRole("button");
    const count = await chips.count();
    const perPage: number[] = [];
    if (count === 0) perPage.push(await visibleFields(page));
    for (let i = 0; i < count; i++) {
      await chips.nth(i).click();
      perPage.push(await visibleFields(page));
    }
    report[step] = perPage;
  }
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/form-quality.json", JSON.stringify(report, null, 2));
  console.info("Fields per page:", JSON.stringify(report));
  for (const [step, perPage] of Object.entries(report)) {
    expect(perPage.length, `pages in ${step}`).toBeLessThanOrEqual(5);
    // Survey format (UX-006): a page holds one topic, about a screen of answers.
    for (const n of perPage) expect(n, `fields on a page of ${step}`).toBeLessThanOrEqual(6);
  }
});

test("attachments are one compact row; details open on hover and on focus (UX-008)", async ({
  page,
}) => {
  await signIn(page);
  await openStep(page, "f");
  await page
    .getByRole("list", { name: "Pages of this step" })
    .getByRole("button", { name: /Documents/ })
    .click();
  const slot = page.locator("[data-document-type]").first();
  await expect(slot).toBeVisible();
  expect((await slot.boundingBox())!.height).toBeLessThanOrEqual(80);

  const details = slot.getByRole("button", { name: /^Details for/ });
  // The page glides to the documents; hover once it has stopped (a still mouse gets no
  // pointerenter from content scrolling under it).
  await expect
    .poll(async () => {
      const before = (await details.boundingBox())?.y;
      await page.waitForTimeout(120);
      return before === (await details.boundingBox())?.y;
    })
    .toBe(true);
  await details.hover();
  await expect(page.getByText("Formats")).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.getByText("Formats")).toHaveCount(0);

  await details.focus();
  await expect(page.getByText("Formats")).toBeVisible();
  await page.keyboard.press("Escape");

  // Upload a photo: the row shows the picture itself, and the preview opens it in place.
  await slot
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "letter.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  await expect(slot.getByText("Uploaded")).toBeVisible({ timeout: 15_000 });
  await expect(slot.locator("img")).toHaveCount(1);
  await slot.getByRole("button", { name: /^Preview letter\.png/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("img", { name: "letter.png" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Download" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("waiting shows a result-shaped skeleton, then the result (UX-009)", async ({ page }) => {
  await signIn(page);
  // A slow register: the lookup answers after 1.5 s.
  await page.route("**/api/lookup/licence**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await openStep(page, "f");
  await page
    .getByRole("list", { name: "Pages of this step" })
    .getByRole("button", { name: /Supervision/ })
    .click();
  await page.getByLabel("Supervisor's licence number").fill("PBK-2023-00102");
  await expect(page.getByRole("status").filter({ hasText: "Checking the licence…" })).toBeVisible();
  await expect(page.locator('[data-licence-result="ok"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "Checking the licence…" })).toHaveCount(
    0,
  );
});

for (const scheme of ["light", "dark"] as const) {
  test(`Section F has no serious accessibility violations in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signIn(page);
    await openStep(page, "f");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(serious).toEqual([]);
  });
}

test("graphics show their end state with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await openStep(page, "f");
  await page
    .getByRole("list", { name: "Pages of this step" })
    .getByRole("button", { name: /Supervision/ })
    .click();
  const chain = page.locator('[data-graphic="supervision-chain"]');
  await expect(chain).toBeVisible();
  const duration = await chain
    .locator("line")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration) || 0);
  expect(duration).toBeLessThanOrEqual(0.1);
});
