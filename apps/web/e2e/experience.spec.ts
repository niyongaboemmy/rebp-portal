import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { settle } from "./settle";

/** UI modernisation (docs/UI_MODERNIZATION_PLAN.md): public experience, SEO, motion, a11y. */

async function seriousViolations(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const path of ["/eligibility", "/register", "/check", "/check/RL-0000", "/dashboard"]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`no serious accessibility violations on ${path} in ${scheme} (UX-002)`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      if (path === "/dashboard") {
        // Signed-out users are sent to sign-in; that page is what we audit here.
        await expect(page).toHaveURL(/\/sign-in/);
      }
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
}

test("landing page in dark mode passes the full audit", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await seriousViolations(page)).toEqual([]);
});

test("eligibility check recommends a category with documents (FR-PORTAL-006)", async ({ page }) => {
  await page.goto("/eligibility");
  await page.getByRole("button", { name: "Me, as an individual" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "A2 certificate" }).click();
  await page.getByRole("button", { name: "No licence yet" }).click();
  await expect(page.getByText("You can apply as")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Field Sales and Leasing Agent" }),
  ).toBeVisible();
  await expect(page.getByText("Entry-level training certificate")).toBeVisible();
});

test("eligibility check shows experience progress towards the next category", async ({ page }) => {
  await page.goto("/eligibility");
  await page.getByRole("button", { name: "Me, as an individual" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "Real estate or valuation degree" }).click();
  await page.getByRole("button", { name: "Real Estate Agent" }).click();
  await page.getByRole("button", { name: "One year more" }).click();
  await page.getByRole("button", { name: "One year more" }).click();
  await page.getByRole("button", { name: "See my result" }).click();
  const meter = page.getByRole("meter");
  await expect(meter).toHaveAttribute("aria-valuenow", "2");
  await expect(meter).toHaveAttribute("aria-valuetext", "2 of 3 years");
});

test("category ladder opens the requirements for a rung", async ({ page }) => {
  await page.goto("/categories");
  await page
    .getByRole("button", { name: /Real Estate Broker/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Real Estate Broker" })).toBeVisible();
  await expect(dialog.getByText("3 years documented as REA")).toBeVisible();
});

test("licence check states clearly when nothing matches and is not indexed", async ({ page }) => {
  await page.goto("/check/rl-404");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No licence found");
  await expect(page.getByText("RL-404", { exact: false }).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("register filters live in the URL (FR-REG-002)", async ({ page }) => {
  await page.goto("/register?q=Uwase");
  await page.getByRole("link", { name: "REA", exact: true }).click();
  await expect(page).toHaveURL(/category=REA/);
  await expect(page).toHaveURL(/q=Uwase/);
  await expect(page.getByRole("link", { name: "REA", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("command palette jumps to a page (⌘K / Ctrl+K)", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("combobox", { name: "Search or jump to…" });
  await expect(input).toBeFocused();
  await input.fill("categ");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/categories$/);
});

test("language URLs render in their language with hreflang alternates (ADR-010)", async ({
  page,
}) => {
  await page.goto("/fr/categories");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  for (const lang of ["en", "rw", "fr", "x-default"]) {
    await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
  }
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fr\/categories$/);
  await page.context().clearCookies();
});

test("locale prefixes never apply to private areas", async ({ page }) => {
  await page.goto("/rw/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  await page.context().clearCookies();
});

test("robots, sitemap and manifest are served (SEO, UX-015)", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /dashboard");
  expect(robots).toContain("Sitemap: http://localhost:3100/sitemap.xml");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain('hreflang="rw"');
  expect(sitemap).toContain("http://localhost:3100/fr/register");

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ short_name: "REBP", display: "standalone" });

  const icon = await request.get("/pwa-icon/512?maskable=1");
  expect(icon.headers()["content-type"]).toBe("image/png");
  expect((await request.get("/pwa-icon/77")).status()).toBe(404);
});

test("structured data describes the site search (SEO)", async ({ page }) => {
  await page.goto("/");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const data = blocks.flatMap((b) => JSON.parse(b) as Record<string, unknown>[]);
  expect(data.some((d) => d["@type"] === "WebSite")).toBe(true);
});

test("reduced motion removes movement but keeps the page usable (UX-002)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .locator(".animate-rise")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(duration).toBeLessThanOrEqual(0.1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the pilot banner can be dismissed for the session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText(/Pilot release/)).toBeHidden();
  await page.reload();
  await expect(page.getByText(/Pilot release/)).toBeHidden();
  await page.context().clearCookies();
});
