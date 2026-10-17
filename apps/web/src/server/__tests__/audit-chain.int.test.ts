import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { recordAudit, verifyAuditChain } from "../audit/audit";

describe("audit trail (FR-AUD-001…003, ADR-007)", () => {
  it("chains events and verifies them", async () => {
    await recordAudit({
      action: "test.one",
      entityType: "Test",
      entityId: "1",
      metadata: { b: 2, a: 1 },
    });
    await recordAudit({ action: "test.two", entityType: "Test", entityId: "2" });
    const [last, prev] = await db.auditEvent.findMany({ orderBy: { id: "desc" }, take: 2 });
    expect(last!.prevHash).toBe(prev!.hash);
    expect(await verifyAuditChain()).toMatchObject({ ok: true });
  });

  it("serialises concurrent writers without forking the chain", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        recordAudit({ action: "test.concurrent", entityType: "Test", entityId: String(i) }),
      ),
    );
    expect(await verifyAuditChain()).toMatchObject({ ok: true });
  });

  it("rejects UPDATE and DELETE at the database level", async () => {
    await recordAudit({ action: "test.immutable", entityType: "Test" });
    const event = await db.auditEvent.findFirstOrThrow({ orderBy: { id: "desc" } });
    await expect(
      db.auditEvent.update({ where: { id: event.id }, data: { action: "tampered" } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
  });

  it("detects tampering even when triggers are bypassed", async () => {
    await recordAudit({ action: "test.tamper", entityType: "Test", metadata: { amount: 100 } });
    const event = await db.auditEvent.findFirstOrThrow({ orderBy: { id: "desc" } });
    const tamper = async (metadata: object) =>
      db.$transaction([
        db.$executeRawUnsafe("SET LOCAL session_replication_role = replica"),
        db.auditEvent.update({ where: { id: event.id }, data: { metadata } }),
      ]);
    try {
      await tamper({ amount: 1 });
      const broken = await verifyAuditChain();
      expect(broken.ok).toBe(false);
      expect(broken.brokenAtId).toBe(event.id);
    } finally {
      // Restore exactly what was stored (recordAudit adds fields such as actorRole, FR-AUD-002),
      // even when an assertion fails: the test database's chain outlives this run.
      await tamper(event.metadata as object);
    }
    expect(await verifyAuditChain()).toMatchObject({ ok: true });
  });
});
