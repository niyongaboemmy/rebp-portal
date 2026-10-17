import {
  parseShellPrefs,
  SHELL_PREFS_COOKIE,
  serializeShellPrefs,
  type ShellPrefs,
} from "@rebp/contracts";

const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(): string | undefined {
  const prefix = `${SHELL_PREFS_COOKIE}=`;
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

/**
 * Merges a change into the layout-preference cookie (ADR-011). Cosmetic only, so it is written
 * from the client without a server round trip; the server reads it on the next request.
 */
export function writeShellPrefs(patch: Partial<ShellPrefs>): ShellPrefs {
  const next = { ...parseShellPrefs(readCookie()), ...patch };
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${SHELL_PREFS_COOKIE}=${serializeShellPrefs(next)}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`;
  return next;
}
