import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "./db";
import { settle } from "./settle";

/**
 * Authenticated shell (ADR-011, UX-001): collapsible sidebar remembered across reloads, grouped
 * back-office navigation, breadcrumbs, one account menu, and a layout that holds from 320 to
 * 2560 px.
 */
const PASSWORD = "Rebp-Demo-Pilot-2026";
const OFFICER = "officer@demo.rebp.rw";

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

const sidebarWidth = (page: Page) =>
  page.locator("#app-sidebar").evaluate((el) => el.getBoundingClientRect().width);

test.beforeAll(async () => {
  await db.user.update({
    where: { email: OFFICER },
    data: { mfaMethods: ["EMAIL"], mfaPreferred: "EMAIL" },
  });
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("the sidebar collapses with ⌘B and stays collapsed after a reload (N1)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice");
  expect(await sidebarWidth(page)).toBeGreaterThan(200);

  const trigger = page.getByRole("button", { name: "Collapse sidebar" });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ControlOrMeta+b");
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect.poll(() => sidebarWidth(page)).toBeLessThan(80);

  // The server renders the remembered state: no shift on reload.
  await page.reload();
  expect(await sidebarWidth(page)).toBeLessThan(80);

  // On the rail the label is a tooltip, and stays in the link's accessible name.
  const queue = page.locator("#app-sidebar").getByRole("link", { name: /Work queue/ });
  await queue.hover();
  await expect(page.getByRole("tooltip")).toContainText("Work queue");

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBeGreaterThan(200);
});

test("back-office navigation is grouped and the breadcrumb shows where you are (N2, T1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice/queue");
  const nav = page.locator("#app-sidebar").getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("group", { name: "Work" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Work queue/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // Account pages are not in the main navigation any more (N6).
  await expect(nav.getByRole("link", { name: "Security" })).toHaveCount(0);

  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Back office" })).toBeVisible();
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Work queue");

  // The logo row and the top bar share a baseline (A3).
  const logo = await page.locator("#app-sidebar a").first().boundingBox();
  const bar = await page.locator("header.app-top-bar").boundingBox();
  expect(Math.abs(logo!.y + logo!.height / 2 - (bar!.y + bar!.height / 2))).toBeLessThanOrEqual(1);
});

test("one account menu: settings, theme and layout preferences (U1, S6)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice");
  await page.getByRole("button", { name: /^Account, / }).click();
  await expect(page.getByRole("menuitem", { name: "My access" })).toBeVisible();
  await page.getByRole("menuitem", { name: /Layout/ }).hover();
  await page.getByRole("menuitemradio", { name: "Compact" }).click();
  await expect(page.locator("[data-sidebar]")).toHaveAttribute("data-density", "compact");

  await page.reload();
  await expect(page.locator("[data-sidebar]")).toHaveAttribute("data-density", "compact");
});

test("tablets get an icon rail whose trigger opens the full sidebar (UX-001)", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice");
  expect(await sidebarWidth(page)).toBeLessThan(80);

  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: /Work queue/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await sheet.getByRole("link", { name: /Work queue/ }).click();
  await expect(page).toHaveURL(/\/backoffice\/queue$/);
  await expect(sheet).toBeHidden();
});

test("no sideways scroll and the identity card stays in view from 320 to 2560 px", async ({
  page,
}) => {
  await signIn(page, OFFICER);
  for (const width of [320, 375, 768, 1024, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/backoffice/queue");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    if (width >= 768) {
      const card = await page
        .locator("#app-sidebar")
        .getByRole("button", { name: /^Account, / })
        .boundingBox();
      expect(card!.y + card!.height, `${width}px`).toBeLessThanOrEqual(900);
    }
  }
});

test("the shell has no serious accessibility violations, rail or expanded, light or dark", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice");
  for (const collapsed of [false, true]) {
    if (collapsed) await page.keyboard.press("ControlOrMeta+b");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settle(page);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .exclude("[data-sonner-toaster]")
        .analyze();
      const serious = result.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        serious.map(
          (v) => `[${collapsed ? "rail" : "sidebar"} ${scheme}] ${v.id}: ${v.nodes[0]?.target}`,
        ),
      ).toEqual([]);
    }
  }
});

test("keyboard order is skip link, sidebar, top bar, then the page (WCAG 2.4.3)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice/queue");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#app-sidebar")))).toBe(
    true,
  );

  // The skip link lands on the page content.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("focused controls are never hidden under the sticky top bar (WCAG 2.4.11)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await signIn(page, OFFICER);
  await page.goto("/settings/security");
  const bar = await page.locator("header.app-top-bar").boundingBox();
  await page
    .locator("#main")
    .focus()
    .catch(() => {});
  await page.getByRole("heading", { level: 1 }).click();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const rect = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest("#main")) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    if (rect) expect(rect.bottom, `tab ${i}`).toBeGreaterThan(bar!.y + bar!.height);
  }
});

test("long French and Kinyarwanda labels fit the shell (UX-003)", async ({ page, context }) => {
  await signIn(page, OFFICER);
  for (const locale of ["fr", "rw"]) {
    // Root-path cookies, so each locale replaces the last one.
    const domain = new URL(page.url()).hostname;
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, domain, path: "/" },
      {
        name: "rebp_shell",
        value: "sidebar=expanded&density=comfortable&width=default",
        domain,
        path: "/",
      },
    ]);
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/backoffice/queue");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll("#app-sidebar .truncate, header.app-top-bar .truncate")]
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && !el.getAttribute("title"))
          .map((el) => el.textContent?.trim()),
      );
      expect(clipped, `${locale} ${width}px`).toEqual([]);
      const bar = await page.locator("header.app-top-bar").boundingBox();
      expect(bar!.height, `${locale} ${width}px top bar is one line`).toBeLessThanOrEqual(64);
    }
  }
});

test("the sidebar resizes from its edge, by pointer or keyboard, and remembers it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice");
  const separator = page.getByRole("separator", { name: "Resize sidebar" });
  await expect(separator).toHaveAttribute("aria-valuenow", "256");

  // Keyboard (window-splitter pattern).
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "288");
  await expect.poll(() => sidebarWidth(page)).toBe(288);

  // Pointer drag, then a reload keeps the width.
  const edge = (await separator.boundingBox())!;
  await page.mouse.move(edge.x + 4, edge.y + 300);
  await page.mouse.down();
  await page.mouse.move(edge.x - 28, edge.y + 300, { steps: 5 });
  await page.mouse.up();
  await page.reload();
  expect(await sidebarWidth(page)).toBe(256);

  // Double-click resets; End jumps to the maximum.
  await separator.focus();
  await page.keyboard.press("End");
  await expect.poll(() => sidebarWidth(page)).toBe(320);
  await separator.dblclick();
  await expect.poll(() => sidebarWidth(page)).toBe(256);
});

test("⌘K lists recent pages before you type and tolerates typos", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  for (const path of ["/backoffice/queue", "/backoffice/finance", "/backoffice"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(500); // the tracker records once the title is set
  }
  await page.keyboard.press("ControlOrMeta+k");
  const recent = page.getByRole("listbox").getByRole("group").first();
  await expect(recent.getByRole("option").first()).toHaveText("Finance");
  await expect(recent.getByRole("option", { name: "Back office" })).toHaveCount(0); // current page

  await page.getByRole("combobox").fill("wrk q");
  await expect(page.getByRole("option").first()).toHaveText("Work queue");
});

test("hovering the expanded sidebar leaves no tooltips behind when it collapses", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice");
  for (const name of [/Work queue/, /Finance/, /Reports/]) {
    await page.locator("#app-sidebar").getByRole("link", { name }).hover();
    await page.waitForTimeout(300);
  }
  await page.mouse.move(800, 500);
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(() => sidebarWidth(page)).toBeLessThan(80);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("the tablet sheet stays closed when you come back to the page it was opened on", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await signIn(page, OFFICER);
  await page.goto("/backoffice");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /Work queue/ })
    .click();
  await expect(page).toHaveURL(/\/backoffice\/queue$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/backoffice$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("foldables, landscape phones and 400% zoom keep the shell usable (WCAG 1.4.10)", async ({
  browser,
}) => {
  const login = await browser.newContext();
  await signIn(await login.newPage(), OFFICER);
  const storageState = await login.storageState();
  await login.close();
  for (const [width, height, label] of [
    [280, 653, "foldable"],
    [667, 375, "landscape phone"],
    [640, 450, "200% zoom"],
    [320, 256, "400% zoom"],
  ] as const) {
    const context = await browser.newContext({ storageState, viewport: { width, height } });
    const page = await context.newPage();
    for (const path of ["/backoffice", "/backoffice/queue", "/backoffice/reports"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${label} ${path}`).toBeLessThanOrEqual(0);
    }
    const tabs = page.getByRole("navigation", { name: "Primary" });
    const bar = (await tabs.locator("ul").boundingBox())!;
    const top = (await page.locator("header.app-top-bar").boundingBox())!;
    if (height < 640) {
      // Short screens: compact chrome gives height back to content.
      expect(bar.height, `${label} tab bar`).toBe(48);
      expect(top.height, `${label} top bar`).toBe(52);
    }
    // Tabs stay at least 44 px tall and keep their names when labels are hidden.
    expect(bar.height).toBeGreaterThanOrEqual(44);
    await expect(tabs.getByRole("link", { name: "Overview" })).toBeVisible();
    await context.close();
  }
});
