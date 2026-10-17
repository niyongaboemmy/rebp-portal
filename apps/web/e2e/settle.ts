import type { Page } from "@playwright/test";

/**
 * Waits for finite entrance animations to finish so audits see the settled UI. Infinite ones
 * (live-status pulses, skeleton shimmer) are ignored, or this would never resolve; so are
 * perpetual loops that restart finite animations (anything inside [data-loop]: hero deck,
 * guides, the phone scene, the category tour). Autoplaying
 * content is paused first with its own visible control, as a user would (WCAG 2.2.2).
 */
export async function settle(page: Page) {
  for (const toggle of await page.locator("[data-autoplay-toggle]").all()) {
    if (/pause/i.test((await toggle.textContent()) ?? "")) await toggle.click();
  }
  await page.mouse.move(0, 0);
  await page.waitForFunction(() =>
    document.getAnimations().every(
      (a) =>
        a.playState !== "running" ||
        a.effect?.getComputedTiming().iterations === Infinity ||
        // Scroll-driven animations (e.g. the top bar's edge) follow scrolling, not time:
        // they never "finish", so waiting for them would never resolve.
        !(a.timeline instanceof DocumentTimeline) ||
        !!((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest("[data-loop]"),
    ),
  );
}
