import type { Prisma } from "@/generated/prisma/client";

/**
 * Register projection (ADR-006, FR-REG-003) as a pure function of a Prisma client, shared by the
 * server and the seed script (which runs outside Next.js). Only public fields are written.
 */
/** Any Prisma client or transaction (the seed passes its own). */
type Client = Pick<
  Prisma.TransactionClient,
  "licence" | "registrant" | "firm" | "branch" | "adminDivision" | "registerEntry"
>;

export interface PublicCondition {
  code: string;
  text?: string;
  endsOn?: string;
  publicOnRegister?: boolean;
}

export async function projectLicenceWith(client: Client, licenceId: string) {
  const licence = await client.licence.findUnique({ where: { id: licenceId } });
  if (!licence) return;
  // One relation at a time, not `include`: Prisma loads included relations concurrently, and a
  // transaction (licence issuance passes one) has a single connection that can't run queries in
  // parallel (pg deprecation today, an error in pg 9).
  const firmFields = {
    legalName: true,
    tradingName: true,
    district: true,
    principalLicenceId: true,
  } as const;
  const registrant = await client.registrant.findUniqueOrThrow({
    where: { id: licence.registrantId },
    select: { registrationNo: true, kind: true },
  });
  const ownFirm = licence.firmId
    ? await client.firm.findUnique({ where: { id: licence.firmId }, select: firmFields })
    : null;
  const affiliatedFirm =
    !ownFirm && licence.affiliatedFirmId
      ? await client.firm.findUnique({
          where: { id: licence.affiliatedFirmId },
          select: firmFields,
        })
      : null;
  const branch = licence.branchId
    ? await client.branch.findUnique({
        where: { id: licence.branchId },
        select: { name: true, district: true },
      })
    : null;
  const firm = ownFirm ?? affiliatedFirm;
  const district = branch?.district ?? firm?.district ?? null;
  const districtRow = district
    ? await client.adminDivision.findUnique({ where: { code: district } })
    : null;
  const principal =
    licence.category === "REBF" && ownFirm?.principalLicenceId
      ? await client.licence.findUnique({
          where: { id: ownFirm.principalLicenceId },
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
    registrant.registrationNo,
    licence.licenceNo,
    firm?.legalName,
    firm?.tradingName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const data = {
    registrationNo: registrant.registrationNo,
    licenceNo: licence.licenceNo,
    kind: registrant.kind,
    displayName: licence.displayName,
    category: licence.category,
    status: licence.status,
    issuedAt: licence.issuedAt,
    expiresAt: licence.expiresAt,
    firmName,
    branchName: branch?.name ?? null,
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
