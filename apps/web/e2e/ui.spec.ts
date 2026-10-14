import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/sign-in", "/sign-up", "/categories", "/forgot-password"]) {
  test(`no serious accessibility violations on ${path} (UX-002)`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });
}

test("dark theme also passes contrast checks", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  expect(results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
});

test("language switcher changes the UI and is remembered (UX-003)", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: /Français/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bon retour");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bon retour");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.context().clearCookies();
});

test("sends security headers (SEC-002)", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("health endpoint reports the database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok", db: "up" });
});
