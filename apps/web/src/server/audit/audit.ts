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
  /**
   * FR-AUD-002: the actor's role at the time ("SYSTEM" for jobs). Derived from the actor's roles
   * when omitted. Stored in metadata, so the table shape and the chain inputs stay unchanged.
   */
  actorRole?: string | null;
  /** FR-AUD-002 before/after values; stored as a field-level diff in `metadata.changes`. */
  before?: unknown;
  after?: unknown;
  /** Dotted paths whose values are hashed in the diff (FR-AUD-002 "sensitive values hashed"). */
  sensitive?: readonly string[];
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

// ---------------------------------------------------------------------------
// FR-AUD-002: actor role and field-level before/after diff
// ---------------------------------------------------------------------------

export interface FieldChange {
  /** Dotted path, e.g. "fees.REA.licensing". */
  field: string;
  before: unknown;
  after: unknown;
}

type Leaf = string | number | boolean | null;

function leaves(value: unknown, prefix: string, out: Map<string, Leaf>) {
  if (value instanceof Date) out.set(prefix, value.toISOString());
  else if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0 && prefix) out.set(prefix, canonicalJson(value));
    for (const [k, v] of entries) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(value)) out.set(prefix, canonicalJson(value));
  else out.set(prefix, (value ?? null) as Leaf);
  return out;
}

/** A short, non-reversible stand-in for a sensitive value in a diff. */
export function hashedValue(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 16)}`;
}

/**
 * Field-level diff of two values (FR-AUD-002). Objects are compared leaf by leaf; arrays as a
 * whole. Paths listed in `sensitive` (or below them) are hashed, never stored in clear.
 */
export function diffValues(
  before: unknown,
  after: unknown,
  sensitive: readonly string[] = [],
): FieldChange[] {
  const a = leaves(before, "", new Map());
  const b = leaves(after, "", new Map());
  const isSensitive = (path: string) =>
    sensitive.some((s) => path === s || path.startsWith(`${s}.`));
  const mask = (path: string, value: Leaf | undefined) =>
    value === undefined ? null : isSensitive(path) ? hashedValue(value) : value;
  return [...new Set([...a.keys(), ...b.keys()])]
    .filter((path) => a.get(path) !== b.get(path))
    .sort()
    .map((path) => ({
      field: path || "value",
      before: mask(path, a.get(path)),
      after: mask(path, b.get(path)),
    }));
}

/** Staff roles first (they explain the action); "SYSTEM" when there is no actor. */
export function roleLabel(roles: readonly string[] | null | undefined): string {
  if (!roles) return "SYSTEM";
  const staff = roles.filter((r) => !["APPLICANT", "SUPERVISOR"].includes(r));
  return (staff.length ? staff : roles).join(",") || "UNKNOWN";
}

async function enrichedMetadata(input: AuditInput): Promise<Record<string, unknown>> {
  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
  let role = input.actorRole;
  if (role === undefined || role === null) {
    if (!input.actorId) role = "SYSTEM";
    else {
      const actor = await db.user.findUnique({
        where: { id: input.actorId },
        select: { roles: true },
      });
      role = actor ? roleLabel(actor.roles) : "UNKNOWN";
    }
  }
  metadata.actorRole ??= role;
  if (input.before !== undefined || input.after !== undefined) {
    metadata.changes = diffValues(input.before ?? null, input.after ?? null, input.sensitive);
  }
  return metadata;
}

/** Appends an event to the hash chain (FR-AUD-001, ADR-007). Serialised with an advisory lock. */
export async function recordAudit(input: AuditInput): Promise<void> {
  // Resolved before taking the chain lock; the result is ordinary metadata, hashed like any other.
  const metadata = await enrichedMetadata(input);
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
      metadata,
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
