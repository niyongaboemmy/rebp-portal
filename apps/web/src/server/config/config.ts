import "server-only";
import {
  CONFIG_DEFAULTS,
  CONFIG_SCHEMAS,
  mayProposeConfig,
  type ConfigKey,
  type ConfigValue,
  type ProposeConfigInput,
} from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import { userCapabilities } from "../access/permissions";
import { recordAudit } from "../audit/audit";
import type { RequestContext } from "../auth/types";
import { db } from "../db";
import { AppError } from "../errors";
import { notifyUsersWithCapability } from "../notifications/inbox";

/**
 * Versioned configuration with maker-checker (FR-ADM-002…004, FR-ELG-002). The value in force at a
 * moment is the highest approved version whose effective date has passed; version 0 is the
 * built-in default. Runs record the version they used, so a change only affects new runs.
 */
export interface ResolvedConfig<K extends ConfigKey> {
  key: K;
  version: number;
  value: ConfigValue<K>;
  effectiveFrom: Date | null;
}

const CACHE_MS = 30_000;
const cache = new Map<
  ConfigKey,
  { at: number; rows: Array<{ version: number; value: unknown; effectiveFrom: Date }> }
>();

async function approvedRows(key: ConfigKey) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  const rows = await db.configVersion.findMany({
    where: { key, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { version: true, value: true, effectiveFrom: true },
  });
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

export function invalidateConfigCache() {
  cache.clear();
}

export async function getConfig<K extends ConfigKey>(
  key: K,
  at: Date = new Date(),
): Promise<ResolvedConfig<K>> {
  const rows = await approvedRows(key);
  const row = rows.find((r) => r.effectiveFrom <= at);
  if (!row)
    return { key, version: 0, value: CONFIG_DEFAULTS[key] as ConfigValue<K>, effectiveFrom: null };
  // Stored values are validated on write; parse again so a hand-edited row cannot break the engine.
  const parsed = CONFIG_SCHEMAS[key].safeParse(row.value);
  return parsed.success
    ? {
        key,
        version: row.version,
        value: parsed.data as ConfigValue<K>,
        effectiveFrom: row.effectiveFrom,
      }
    : { key, version: 0, value: CONFIG_DEFAULTS[key] as ConfigValue<K>, effectiveFrom: null };
}

/**
 * FR-ADM-003: the maker must hold config.edit and the area capability for the key
 * (CONFIG_MAKER_SCOPE). Enforced here so every entry point gets it, not only one server action.
 */
export async function assertConfigMaker(key: ConfigKey, maker: Pick<User, "roles">) {
  if (!mayProposeConfig(key, await userCapabilities(maker))) throw new AppError("forbidden");
}

export async function proposeConfig(input: ProposeConfigInput, maker: User, ctx: RequestContext) {
  await assertConfigMaker(input.key, maker);
  const pending = await db.configVersion.findFirst({
    where: { key: input.key, status: "PENDING" },
  });
  if (pending) throw new AppError("configPending");
  const last = await db.configVersion.findFirst({
    where: { key: input.key },
    orderBy: { version: "desc" },
  });
  // FR-AUD-002: before = the version in force now, after = the proposal.
  const inForce = await getConfig(input.key);
  const row = await db.configVersion.create({
    data: {
      key: input.key,
      version: (last?.version ?? 0) + 1,
      value: input.value as object,
      effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00+02:00`),
      reason: input.reason,
      makerId: maker.id,
    },
  });
  await recordAudit({
    action: "config.proposed",
    entityType: "ConfigVersion",
    entityId: row.id,
    actorId: maker.id,
    metadata: {
      key: input.key,
      version: row.version,
      effectiveFrom: input.effectiveFrom,
      baseVersion: inForce.version,
    },
    before: inForce.value,
    after: input.value,
    ...ctx,
  });
  // N-100: the checker is told a change awaits approval.
  await notifyUsersWithCapability("config.approve", {
    code: "N-100",
    messageKey: "configPending",
    values: { key: input.key, version: row.version },
    href: "/backoffice/configuration",
  });
  return row;
}

export async function decideConfig(
  id: string,
  approve: boolean,
  note: string | undefined,
  checker: User,
  ctx: RequestContext,
) {
  const row = await db.configVersion.findUnique({ where: { id } });
  if (!row || row.status !== "PENDING") throw new AppError("notFound");
  // Maker-checker: the person who proposed a change can never approve it (FR-ADM-003).
  if (row.makerId === checker.id) throw new AppError("makerChecker");
  const inForce = await getConfig(row.key as ConfigKey);
  const { count } = await db.configVersion.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: approve ? "ACTIVE" : "REJECTED",
      checkerId: checker.id,
      note,
      decidedAt: new Date(),
    },
  });
  if (count === 0) throw new AppError("notFound");
  invalidateConfigCache();
  await recordAudit({
    action: approve ? "config.approved" : "config.rejected",
    entityType: "ConfigVersion",
    entityId: id,
    actorId: checker.id,
    metadata: {
      key: row.key,
      version: row.version,
      baseVersion: inForce.version,
      status: { before: "PENDING", after: approve ? "ACTIVE" : "REJECTED" },
    },
    // FR-AUD-002: the change decided on (in force → proposed); `status` says which way it went.
    before: inForce.value,
    after: row.value,
    ...ctx,
  });
}

/** History for the configuration console. */
export async function configHistory(key: ConfigKey) {
  return db.configVersion.findMany({ where: { key }, orderBy: { version: "desc" }, take: 20 });
}
