import type { Route } from "next";

/**
 * Where each dashboard element leads (UX-040), built on the server from the viewer's capabilities:
 * an absent link means that console is not theirs, so the element shows no action. String "bases"
 * end in `=` and take a value (a status, a reference number, a role).
 */
export interface DashLinks {
  queueSla?: Route;
  queueMine?: Route;
  queueAll?: Route;
  queueDeadline?: Route;
  queueNewest?: Route;
  queueUnassigned?: Route;
  /** `/backoffice/queue?view=all&sort=stale&status=` + stage. */
  queueStatus?: string;
  /** `/backoffice/queue?view=all&q=` + reference number. */
  queueSearch?: string;
  decisions?: Route;
  register?: Route;
  configuration?: Route;
  reports?: Route;
  accessNoMfa?: Route;
  accessActive?: Route;
  /** `/backoffice/access?role=` + role. */
  accessRole?: string;
  /** `/backoffice/audit` (the day is added as `?from=…&to=…`). */
  audit?: Route;
}

export const withValue = (base: string | undefined, value: string) =>
  base ? (`${base}${encodeURIComponent(value)}` as Route) : undefined;
