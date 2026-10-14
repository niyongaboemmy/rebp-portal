import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  computeAuditHash,
  GENESIS_HASH,
  maskEmail,
  maskPhone,
} from "../audit/audit";

describe("audit hashing (ADR-007)", () => {
  it("serialises objects with sorted keys", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[1,{"y":2,"z":1}]},"b":1}',
    );
  });

  it("produces a stable hash that changes with any field", () => {
    const fields = {
      occurredAt: new Date("2026-10-19T08:00:00.000Z"),
      actorId: null,
      action: "auth.signin",
      entityType: "User",
      entityId: "u1",
      ipAddress: "127.0.0.1",
      userAgent: "ua",
      metadata: { method: "password" },
      prevHash: GENESIS_HASH,
    };
    const hash = computeAuditHash(fields);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(computeAuditHash({ ...fields, metadata: { method: "password" } })).toBe(hash);
    expect(computeAuditHash({ ...fields, action: "auth.signout" })).not.toBe(hash);
    expect(computeAuditHash({ ...fields, prevHash: "1".repeat(64) })).not.toBe(hash);
  });

  it("masks PII for metadata", () => {
    expect(maskEmail("aline@example.rw")).toBe("al***@example.rw");
    expect(maskPhone("+250788123456")).toBe("+250*****56");
  });
});
