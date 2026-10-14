import { expect, test } from "@playwright/test";

test("mobile layout: no horizontal scroll and the drawer navigates", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Desktop nav is hidden; the drawer holds it.
  await expect(page.getByRole("navigation", { name: "Main navigation" }).first()).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Professional categories");
});

test("mobile sign-in fields meet the 44px touch target (UX-001)", async ({ page }) => {
  await page.goto("/sign-in");
  for (const control of [
    page.getByLabel("Email address"),
    page.getByRole("button", { name: "Sign in", exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
