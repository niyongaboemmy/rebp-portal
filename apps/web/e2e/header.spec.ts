import { expect, test } from "@playwright/test";

/** Public header (v4): transparent over the hero, priority+ links, one account menu, toggles. */

test("header is transparent over the hero and gains a shadow once scrolled", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header").first();
  await expect(header).not.toHaveAttribute("data-scrolled");
  expect(await header.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    "rgba(0, 0, 0, 0)",
  );
  await page.mouse.wheel(0, 600);
  await expect(header).toHaveAttribute("data-scrolled", "true");
  expect(await header.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
});

test("hero fills the viewport", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("section").first();
  const box = await hero.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
});

for (const width of [800, 1024, 1280, 1600]) {
  test(`nav labels stay on one line and never overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main navigation" }).first();
    await expect(nav).toHaveAttribute("data-measured", "true");
    for (const link of await nav.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeLessThanOrEqual(40);
    }
    const header = await page
      .locator("header")
      .first()
      .evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
    expect(header.scroll).toBeLessThanOrEqual(header.client);
  });
}

test("links fold into More when space is short", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 760 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" }).first();
  await expect(nav).toHaveAttribute("data-measured", "true");
  await expect(nav.getByRole("link", { name: "Categories" })).toBeHidden();
  await nav.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/categories$/);
});

test("one account button offers sign in and create account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("menuitem", { name: /Create account/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("language menu switches locale and search is icon-only", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Search and commands" })).toHaveText("");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitemradio", { name: /Français/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.getByRole("button", { name: "Langue" }).click();
  await page.getByRole("menuitemradio", { name: /English/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.context().clearCookies();
});
