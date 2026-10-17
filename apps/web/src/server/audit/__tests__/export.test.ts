import { describe, expect, it } from "vitest";
import { canonicalJson, diffValues, hashedValue, roleLabel } from "../audit";
import {
  buildAuditExport,
  MANIFEST_PREFIX,
  sha256Hex,
  verifyAuditExport,
  type ExportEvent,
} from "../export";

const events: ExportEvent[] = [
  {
    id: "1",
    occurredAt: "2026-10-17T08:00:00.000Z",
    actorId: "u1",
    actorName: 'Aline, "the" Auditor',
    actorRole: "AUDITOR",
    action: "auth.signin",
    entityType: "User",
    entityId: "u1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
    metadata: { method: "password", actorRole: "AUDITOR" },
    prevHash: "0".repeat(64),
    hash: "a".repeat(64),
  },
  {
    id: "2",
    occurredAt: "2026-10-17T09:30:00.000Z",
    actorId: null,
    actorName: null,
    actorRole: "SYSTEM",
    action: "licence.expired",
    entityType: "Licence",
    entityId: "l1",
    ipAddress: null,
    userAgent: null,
    metadata: { licenceNo: "=SUM(A1)", actorRole: "SYSTEM" },
    prevHash: "a".repeat(64),
    hash: "b".repeat(64),
  },
];

const meta = {
  generatedAt: "2026-10-17T10:00:00.000Z",
  generatedBy: "auditor-id",
  filters: { from: "2026-10-17" },
  truncated: false,
  chainHead: { id: "2", hash: "b".repeat(64) },
};

describe("signed audit export (FR-AUD-004)", () => {
  it("CSV: the manifest hash matches the content before the manifest line", () => {
    const { body, manifest } = buildAuditExport("csv", events, meta);
    const content = body.slice(0, body.lastIndexOf(MANIFEST_PREFIX));
    expect(manifest.sha256).toBe(sha256Hex(content));
    expect(manifest).toMatchObject({
      count: 2,
      range: {
        from: "2026-10-17T08:00:00.000Z",
        to: "2026-10-17T09:30:00.000Z",
        firstId: "1",
        lastId: "2",
      },
      chainHead: { id: "2" },
      signature: { algorithm: "HMAC-SHA256" },
    });
    expect(content.split("\n")[0]).toMatch(/^id,occurredAt,actorId,actorName,actorRole,action/);
    // Quoted, not formula-prefixed: the chain inputs must survive verbatim.
    expect(content).toContain('"Aline, ""the"" Auditor"');
    expect(content).toContain(canonicalJson(events[1]!.metadata).replace(/"/g, '""'));
    expect(verifyAuditExport("csv", body)).toMatchObject({ ok: true });
  });

  it("JSON: the hash covers the canonical events", () => {
    const { body, manifest } = buildAuditExport("json", events, meta);
    expect(manifest.sha256).toBe(sha256Hex(canonicalJson(events)));
    expect(JSON.parse(body).events).toHaveLength(2);
    expect(verifyAuditExport("json", body)).toMatchObject({ ok: true });
  });

  it("detects edited content, a forged manifest and garbage", () => {
    const csv = buildAuditExport("csv", events, meta).body;
    expect(verifyAuditExport("csv", csv.replace("auth.signin", "auth.signout"))).toEqual({
      ok: false,
      reason: "content",
    });
    const json = JSON.parse(buildAuditExport("json", events, meta).body);
    json.manifest.count = 1;
    expect(verifyAuditExport("json", JSON.stringify(json))).toEqual({
      ok: false,
      reason: "signature",
    });
    const dropped = JSON.parse(buildAuditExport("json", events, meta).body);
    dropped.events.pop();
    expect(verifyAuditExport("json", JSON.stringify(dropped))).toEqual({
      ok: false,
      reason: "content",
    });
    expect(verifyAuditExport("csv", "id\n1\n")).toEqual({ ok: false, reason: "malformed" });
    expect(verifyAuditExport("json", "{nope")).toEqual({ ok: false, reason: "malformed" });
  });

  it("signs an empty export too", () => {
    const { body, manifest } = buildAuditExport("csv", [], { ...meta, chainHead: null });
    expect(manifest).toMatchObject({ count: 0, range: { from: null, firstId: null } });
    expect(verifyAuditExport("csv", body)).toMatchObject({ ok: true });
  });
});

describe("audit before/after diff and actor role (FR-AUD-002)", () => {
  it("lists changed leaves only, with dotted paths", () => {
    expect(
      diffValues(
        { fees: { REA: { registration: 10, licensing: 20 } }, sample: true, tags: [1] },
        { fees: { REA: { registration: 10, licensing: 25 } }, sample: false, tags: [1, 2] },
      ),
    ).toEqual([
      { field: "fees.REA.licensing", before: 20, after: 25 },
      { field: "sample", before: true, after: false },
      { field: "tags", before: "[1]", after: "[1,2]" },
    ]);
  });

  it("records added and removed fields as null on the missing side", () => {
    expect(diffValues({ a: 1 }, { b: 2 })).toEqual([
      { field: "a", before: 1, after: null },
      { field: "b", before: null, after: 2 },
    ]);
    expect(diffValues(null, "x")).toEqual([{ field: "value", before: null, after: "x" }]);
    expect(diffValues({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("hashes sensitive paths instead of storing them", () => {
    const [change] = diffValues(
      { contact: { phone: "+250788000001" } },
      {
        contact: { phone: "+250788000002" },
      },
      ["contact"],
    );
    expect(change!.before).toBe(hashedValue("+250788000001"));
    expect(change!.after).toMatch(/^sha256:[a-f0-9]{16}$/);
    expect(JSON.stringify(change)).not.toContain("788000002");
  });

  it("labels the actor's role, staff roles first", () => {
    expect(roleLabel(null)).toBe("SYSTEM");
    expect(roleLabel(["APPLICANT", "SUPERVISOR", "PRINCIPAL_BROKER"])).toBe("PRINCIPAL_BROKER");
    expect(roleLabel(["APPLICANT"])).toBe("APPLICANT");
    expect(roleLabel(["SYSTEM_ADMIN", "AUDITOR"])).toBe("SYSTEM_ADMIN,AUDITOR");
  });
});
