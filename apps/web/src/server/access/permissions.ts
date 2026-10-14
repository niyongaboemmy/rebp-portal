import "server-only";
import {
  applyOverrides,
  CAPABILITIES,
  can,
  capabilitiesFor,
  type Capability,
  type PermissionMatrix,
  type PermissionOverride,
  type Role,
} from "@rebp/contracts";
import { db } from "../db";

/**
 * Effective permission matrix = contracts defaults + administrator overrides (RolePermission).
 * Cached in-process; writes invalidate it, and a short TTL bounds staleness across instances.
 */
const TTL_MS = 30_000;
let cache: { matrix: PermissionMatrix; overrides: PermissionOverride[]; loadedAt: number } | null =
  null;

const KNOWN = new Set<string>(CAPABILITIES);

async function load() {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  const rows = await db.rolePermission.findMany();
  // Rows for capabilities removed from the code base are ignored rather than trusted.
  const overrides = rows
    .filter((row) => KNOWN.has(row.capability))
    .map((row) => ({
      role: row.role as Role,
      capability: row.capability as Capability,
      granted: row.granted,
    }));
  cache = { matrix: applyOverrides(overrides), overrides, loadedAt: Date.now() };
  return cache;
}

export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  return (await load()).matrix;
}

export async function getPermissionOverrides(): Promise<PermissionOverride[]> {
  return (await load()).overrides;
}

export function invalidatePermissionCache() {
  cache = null;
}

export async function userCapabilities(user: { roles: readonly Role[] }): Promise<Capability[]> {
  return capabilitiesFor(user.roles, await getPermissionMatrix());
}

export async function userCan(
  user: { roles: readonly Role[] },
  capability: Capability,
): Promise<boolean> {
  return can(user.roles, capability, await getPermissionMatrix());
}
