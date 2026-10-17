import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { env } from "../env";
import { canonicalJson } from "./audit";
import type { AuditFilters } from "./filters";
import { actorNames, actorRoleOf, auditWhere } from "./timeline";

/**
 * Signed audit export (FR-AUD-004). The filtered events, oldest first, with every hash-chain
 * input so an auditor can recompute each event's hash offline, plus a manifest: count, time range,
 * the chain head at export time, the SHA-256 of the content and an HMAC over the manifest keyed
 * from AUTH_SECRET (domain-separated, like the certificate seal).
 *
 * CSV: the content is the CSV text; the manifest is appended as one final line
 * `# rebp-audit-manifest {json}` (strip that line to re-hash). JSON: `{ manifest, events }` where
 * the hash covers `canonicalJson(events)`.
 */
export const EXPORT_LIMIT = 10_000;
export const MANIFEST_PREFIX = "# rebp-audit-manifest ";
export const EXPORT_FORMATS = ["csv", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportEvent {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  prevHash: string;
  hash: string;
}

export interface AuditManifest {
  kind: "rebp-audit-export";
  version: 1;
  format: ExportFormat;
  generatedAt: string;
  generatedBy: string;
  filters: AuditFilters;
  count: number;
  /** True when more events matched than EXPORT_LIMIT; narrow the filters. */
  truncated: boolean;
  range: { from: string | null; to: string | null; firstId: string | null; lastId: string | null };
  /** The newest event of the whole chain when the export was made. */
  chainHead: { id: string; hash: string } | null;
  sha256: string;
  signature: { algorithm: "HMAC-SHA256"; value: string };
}

const CSV_HEADER = [
  "id",
  "occurredAt",
  "actorId",
  "actorName",
  "actorRole",
  "action",
  "entityType",
  "entityId",
  "ipAddress",
  "userAgent",
  "metadata",
  "prevHash",
  "hash",
] as const;

/** RFC 4180 cells. No formula prefixing: the export must reproduce the chain inputs exactly. */
function csvCell(value: string | null): string {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function eventsCsv(events: readonly ExportEvent[]): string {
  const rows = events.map((e) =>
    [
      e.id,
      e.occurredAt,
      e.actorId,
      e.actorName,
      e.actorRole,
      e.action,
      e.entityType,
      e.entityId,
      e.ipAddress,
      e.userAgent,
      canonicalJson(e.metadata),
      e.prevHash,
      e.hash,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_HEADER.join(","), ...rows].join("\n") + "\n";
}

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function signingKey(): string {
  return `${env().AUTH_SECRET}:audit-export`;
}

type Unsigned = Omit<AuditManifest, "signature">;

export function signManifest(manifest: Unsigned): AuditManifest {
  const value = createHmac("sha256", signingKey()).update(canonicalJson(manifest)).digest("hex");
  return { ...manifest, signature: { algorithm: "HMAC-SHA256", value } };
}

/** Content the manifest's sha256 covers. */
export function exportContent(format: ExportFormat, events: readonly ExportEvent[]): string {
  return format === "csv" ? eventsCsv(events) : canonicalJson(events);
}

/** Builds the downloadable body for already-loaded events. */
export function buildAuditExport(
  format: ExportFormat,
  events: readonly ExportEvent[],
  meta: Pick<Unsigned, "generatedAt" | "generatedBy" | "filters" | "truncated" | "chainHead">,
): { body: string; manifest: AuditManifest } {
  const content = exportContent(format, events);
  const manifest = signManifest({
    kind: "rebp-audit-export",
    version: 1,
    format,
    ...meta,
    count: events.length,
    range: {
      from: events[0]?.occurredAt ?? null,
      to: events[events.length - 1]?.occurredAt ?? null,
      firstId: events[0]?.id ?? null,
      lastId: events[events.length - 1]?.id ?? null,
    },
    sha256: sha256Hex(content),
  });
  const body =
    format === "csv"
      ? `${content}${MANIFEST_PREFIX}${JSON.stringify(manifest)}\n`
      : `${JSON.stringify({ manifest, events }, null, 2)}\n`;
  return { body, manifest };
}

export type ExportCheck =
  | { ok: true; manifest: AuditManifest }
  | { ok: false; reason: "malformed" | "signature" | "content" | "count" };

/** Verifies a downloaded export: the manifest signature, the content hash and the count. */
export function verifyAuditExport(format: ExportFormat, body: string): ExportCheck {
  let manifest: AuditManifest;
  let content: string;
  let count: number;
  try {
    if (format === "csv") {
      const at = body.lastIndexOf(MANIFEST_PREFIX);
      if (at < 0) return { ok: false, reason: "malformed" };
      content = body.slice(0, at);
      manifest = JSON.parse(body.slice(at + MANIFEST_PREFIX.length));
      count = content.split("\n").filter(Boolean).length - 1;
    } else {
      const parsed = JSON.parse(body) as { manifest: AuditManifest; events: ExportEvent[] };
      manifest = parsed.manifest;
      content = canonicalJson(parsed.events);
      count = parsed.events.length;
    }
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const { signature, ...unsigned } = manifest;
  const expected = signManifest(unsigned).signature.value;
  const given = Buffer.from(String(signature?.value ?? ""));
  if (given.length !== expected.length || !timingSafeEqual(given, Buffer.from(expected)))
    return { ok: false, reason: "signature" };
  if (sha256Hex(content) !== manifest.sha256) return { ok: false, reason: "content" };
  // CSV rows can span lines when a cell holds a newline; the hash check above is authoritative.
  if (format === "json" && count !== manifest.count) return { ok: false, reason: "count" };
  return { ok: true, manifest };
}

/** Loads the filtered events (oldest first, capped) and builds the signed export. */
export async function auditExport(
  filters: AuditFilters,
  format: ExportFormat,
  generatedBy: string,
  now = new Date(),
) {
  const where = await auditWhere(filters);
  const [rows, head] = await Promise.all([
    db.auditEvent.findMany({ where, orderBy: { id: "asc" }, take: EXPORT_LIMIT + 1 }),
    db.auditEvent.findFirst({ orderBy: { id: "desc" }, select: { id: true, hash: true } }),
  ]);
  const page = rows.slice(0, EXPORT_LIMIT);
  const names = await actorNames(page.map((r) => r.actorId));
  const events: ExportEvent[] = page.map((r) => ({
    id: String(r.id),
    occurredAt: r.occurredAt.toISOString(),
    actorId: r.actorId,
    actorName: r.actorId ? (names.get(r.actorId) ?? null) : null,
    actorRole: actorRoleOf(r.metadata),
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    metadata: r.metadata,
    prevHash: r.prevHash,
    hash: r.hash,
  }));
  return buildAuditExport(format, events, {
    generatedAt: now.toISOString(),
    generatedBy,
    filters,
    truncated: rows.length > EXPORT_LIMIT,
    chainHead: head ? { id: String(head.id), hash: head.hash } : null,
  });
}
