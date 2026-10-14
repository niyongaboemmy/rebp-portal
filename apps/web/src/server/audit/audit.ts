import "server-only";
import { createHash } from "node:crypto";
import { db } from "../db";

export const GENESIS_HASH = "0".repeat(64);
const CHAIN_LOCK_KEY = 7_438_001;

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Must not contain raw PII — use maskEmail / maskPhone. */
  metadata?: Record<string, unknown>;
}

interface ChainFields {
  occurredAt: Date;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  prevHash: string;
}

/** Deterministic JSON (sorted keys) so the hash is stable across runtimes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function computeAuditHash(fields: ChainFields): string {
  return createHash("sha256").update(canonicalJson(fields)).digest("hex");
}

/** Appends an event to the hash chain (FR-AUD-001, ADR-007). Serialised with an advisory lock. */
export async function recordAudit(input: AuditInput): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_KEY})`;
    const last = await tx.auditEvent.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
    const fields: ChainFields = {
      // Millisecond precision matches what Postgres stores, so verification recomputes the same hash.
      occurredAt: new Date(),
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
      prevHash: last?.hash ?? GENESIS_HASH,
    };
    await tx.auditEvent.create({
      data: { ...fields, metadata: fields.metadata as object, hash: computeAuditHash(fields) },
    });
  });
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  brokenAtId?: bigint;
}

/** Recomputes the chain; any edited, inserted or deleted row breaks it (FR-AUD-002). */
export async function verifyAuditChain(): Promise<ChainVerification> {
  let prevHash = GENESIS_HASH;
  let checked = 0;
  let cursor: bigint | undefined;
  for (;;) {
    const batch = await db.auditEvent.findMany({
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    for (const event of batch) {
      const expected = computeAuditHash({
        occurredAt: event.occurredAt,
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
        prevHash,
      });
      if (event.prevHash !== prevHash || event.hash !== expected) {
        return { ok: false, checked, brokenAtId: event.id };
      }
      prevHash = event.hash;
      checked++;
    }
    cursor = batch[batch.length - 1]!.id;
  }
  return { ok: true, checked };
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)}*****${phone.slice(-2)}`;
}
