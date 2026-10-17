import "server-only";
import { cookies } from "next/headers";
import { parseShellPrefs, SHELL_PREFS_COOKIE, type ShellPrefs } from "@rebp/contracts";

/** The viewer's layout preferences, read on the server so the shell's first paint is right. */
export async function readShellPrefs(): Promise<ShellPrefs> {
  const jar = await cookies();
  return parseShellPrefs(jar.get(SHELL_PREFS_COOKIE)?.value);
}
