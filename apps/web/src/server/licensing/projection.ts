import type { Prisma } from "@/generated/prisma/client";

/**
 * Register projection (ADR-006, FR-REG-003) as a pure function of a Prisma client, shared by the
 * server and the seed script (which runs outside Next.js). Only public fields are written.
 */
/** Any Prisma client or transaction (the seed passes its own). */
type Client = Pick<Prisma.TransactionClient, "licence" | "adminDivision" | "registerEntry">;

export interface PublicCondition {
  code: string;
  text?: string;
  endsOn?: string;
  publicOnRegister?: boolean;
}

export async function projectLicenceWith(client: Client, licenceId: string) {
  const licence = await client.licence.findUnique({
    where: { id: licenceId },
    include: {
      registrant: true,
      affiliatedFirm: true,
      branch: true,
      firm: { include: { branches: true } },
    },
  });
  if (!licence) return;
  const firm = licence.firm ?? licence.affiliatedFirm;
  const district = licence.branch?.district ?? firm?.district ?? null;
  const districtRow = district
    ? await client.adminDivision.findUnique({ where: { code: district } })
    : null;
  const principal =
    licence.category === "REBF" && licence.firm?.principalLicenceId
      ? await client.licence.findUnique({
          where: { id: licence.firm.principalLicenceId },
          select: { displayName: true },
        })
      : null;
  const conditions = ((licence.conditions as unknown as PublicCondition[]) ?? [])
    .filter((c) => c.publicOnRegister !== false)
    .map((c) => (c.text ? `${c.code}:${c.text}` : c.code));
  const firmName =
    licence.category === "REBF" ? null : (firm?.tradingName ?? firm?.legalName ?? null);
  const searchText = [
    licence.displayName,
    licence.registrant.registrationNo,
    licence.licenceNo,
    firm?.legalName,
    firm?.tradingName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const data = {
    registrationNo: licence.registrant.registrationNo,
    licenceNo: licence.licenceNo,
    kind: licence.registrant.kind,
    displayName: licence.displayName,
    category: licence.category,
    status: licence.status,
    issuedAt: licence.issuedAt,
    expiresAt: licence.expiresAt,
    firmName,
    branchName: licence.branch?.name ?? null,
    district,
    province: districtRow?.parentCode ?? null,
    scope: licence.scope,
    conditions,
    principalName: principal?.displayName ?? null,
    qrToken: licence.qrToken,
    searchText,
  };
  await client.registerEntry.upsert({
    where: { licenceId },
    update: data,
    create: { licenceId, ...data },
  });
}
