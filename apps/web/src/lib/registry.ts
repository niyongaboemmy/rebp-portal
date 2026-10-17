import type { Category, LicenseStatus } from "@rebp/contracts";

/**
 * One public register entry, serialisable for client components (FR-REG-003: public fields
 * only; dates as ISO strings, division codes resolved to names). Used by the registry card, the
 * preview dialog, search suggestions and the map.
 */
export interface PublicEntry {
  licenceNo: string;
  registrationNo: string;
  kind: "PERSON" | "FIRM";
  displayName: string;
  category: Category;
  status: LicenseStatus;
  issuedAt: string;
  expiresAt: string;
  firm: string | null;
  principalName: string | null;
  district: string | null;
  districtName: string | null;
  scope: string[];
  conditions: string[];
}

/** How far through its term a licence is (0–1) and the months left, as of now. */
export function termProgress(issuedAt: string, expiresAt: string, now: number) {
  const start = new Date(issuedAt).getTime();
  const end = new Date(expiresAt).getTime();
  return {
    progress: Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start))),
    monthsLeft: Math.max(0, Math.round((end - now) / (30.44 * 24 * 3600 * 1000))),
  };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
