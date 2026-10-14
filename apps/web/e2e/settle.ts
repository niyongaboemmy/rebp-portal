import type { Page } from "@playwright/test";

/**
 * Waits for finite entrance animations to finish so audits see the settled UI. Infinite ones
 * (live-status pulses, skeleton shimmer) are ignored, or this would never resolve. Autoplaying
 * content is paused first with its own visible control, as a user would (WCAG 2.2.2).
 */
export async function settle(page: Page) {
  for (const toggle of await page.locator("[data-autoplay-toggle]").all()) {
    if (/pause/i.test((await toggle.textContent()) ?? "")) await toggle.click();
  }
  await page.mouse.move(0, 0);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
}
