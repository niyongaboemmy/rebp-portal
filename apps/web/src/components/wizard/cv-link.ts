import type { Route } from "next";

/**
 * A link into the CV at one part (UX-021), optionally focusing an answer or adding a period, with
 * the way back to this application step.
 */
export function cvHref(
  applicationId: string,
  part: "c" | "d" | "e",
  extra: Record<string, string> = {},
): Route {
  const params = new URLSearchParams({
    part,
    ...extra,
    next: `/applications/${applicationId}/wizard?step=${part}`,
  });
  return `/settings/cv?${params}` as Route;
}
