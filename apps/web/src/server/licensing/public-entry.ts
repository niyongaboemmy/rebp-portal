import "server-only";
import type { PublicEntry } from "@/lib/registry";
import type { searchRegister } from "./register";
import { divisionNames } from "./public-queries";

type RegisterRow = NonNullable<Awaited<ReturnType<typeof searchRegister>>>["entries"][number];

/** Register rows → serialisable public entries, with district and scope codes as names. */
export async function toPublicEntries(rows: RegisterRow[]): Promise<PublicEntry[]> {
  const names = await divisionNames(
    rows.flatMap((r) => [...(r.district ? [r.district] : []), ...r.scope]),
  );
  return rows.map((r) => ({
    licenceNo: r.licenceNo,
    registrationNo: r.registrationNo,
    kind: r.kind,
    displayName: r.displayName,
    category: r.category,
    status: r.status,
    issuedAt: new Date(r.issuedAt).toISOString(),
    expiresAt: new Date(r.expiresAt).toISOString(),
    firm: [r.firmName, r.branchName].filter(Boolean).join(" · ") || null,
    principalName: r.principalName,
    district: r.district,
    districtName: r.district ? (names.get(r.district) ?? r.district) : null,
    scope: r.scope.map((c) => names.get(c) ?? c),
    conditions: r.conditions,
  }));
}
