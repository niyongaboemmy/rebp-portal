import { expect, test } from "@playwright/test";
import { settle } from "./settle";

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
  await settle(page); // measure the settled layout, not a frame of the entrance animation
  for (const control of [
    page.getByLabel("Email address"),
    page.getByRole("button", { name: "Sign in", exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("public pages never scroll sideways on a phone (UX-001)", async ({ page }) => {
  for (const path of ["/eligibility", "/register", "/categories", "/check", "/check/RL-1"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("signed-in phones get a bottom tab bar and a More sheet", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("applicant@demo.rebp.rw");
  await page.getByLabel("Password", { exact: true }).fill("Rebp-Demo-Pilot-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const tabs = page.getByRole("navigation", { name: "Primary" });
  await expect(tabs).toBeVisible();
  const home = tabs.getByRole("link", { name: "Dashboard" });
  await expect(home).toHaveAttribute("aria-current", "page");
  expect((await home.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

  await tabs.getByRole("link", { name: "Applications" }).click();
  await expect(page).toHaveURL(/\/applications$/);

  // More: every destination as a tile.
  await tabs.getByRole("button", { name: "More" }).click();
  const more = page.getByRole("dialog");
  await more.getByRole("link", { name: "Licence wallet" }).click();
  await expect(page).toHaveURL(/\/licenses$/);
  await expect(more).toBeHidden();

  // Account, theme and language live in one sheet behind the top-bar avatar (ADR-011).
  await page.getByRole("button", { name: /^Account, / }).click();
  const account = page.getByRole("dialog");
  await account.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await account.getByRole("link", { name: "Security" }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(account).toBeHidden();
});
