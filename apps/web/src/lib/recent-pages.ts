/**
 * Recently visited pages for the command palette (⌘K shows them before you type). A per-viewer
 * convenience in localStorage, scoped to the signed-in account and cleared on sign-out, so a
 * shared computer never shows one person's pages to the next. Storage can be unavailable
 * (private mode, blocked site data): every access is guarded and failure means "no recents".
 */
export interface RecentPage {
  href: string;
  title: string;
}

const PREFIX = "rebp:recent:";
const LIMIT = 6;

export function readRecentPages(key: string): RecentPage[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFIX + key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (p): p is RecentPage => typeof p?.href === "string" && typeof p?.title === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function recordRecentPage(key: string, page: RecentPage): void {
  try {
    const rest = readRecentPages(key).filter((p) => p.href !== page.href);
    localStorage.setItem(PREFIX + key, JSON.stringify([page, ...rest].slice(0, LIMIT)));
  } catch {
    // Storage unavailable: recents are a convenience only.
  }
}

/** On sign-out: forget every account's recents on this device. */
export function clearRecentPages(): void {
  try {
    for (const name of Object.keys(localStorage))
      if (name.startsWith(PREFIX)) localStorage.removeItem(name);
  } catch {
    // Nothing to clear.
  }
}
