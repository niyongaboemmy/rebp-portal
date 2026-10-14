import type { Page } from "@playwright/test";

/**
 * Waits for finite entrance animations to finish so audits see the settled UI. Infinite ones
 * (live-status pulses, skeleton shimmer) are ignored, or this would never resolve.
 */
export async function settle(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
}
