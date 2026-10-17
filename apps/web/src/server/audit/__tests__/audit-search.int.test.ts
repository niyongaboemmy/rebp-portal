import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { recordAudit, verifyAuditChain } from "@/server/audit/audit";
import { auditExport, verifyAuditExport } from "@/server/audit/export";
import { auditTimeline, auditWhere } from "@/server/audit/timeline";
import { getConfig, proposeConfig, decideConfig } from "@/server/config/config";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ctx, resetDatabase } from "@/test/db";
import { makeUser } from "@/test/fixtures";

/**
 * FR-AUD-002/004 against the database: actor role and before/after diff in metadata (the chain
 * still verifies), search by actor, entity/reference, action and date range, and the signed export.
 * AuditEvent is append-only and shared across files, so each test scopes itself with a unique
 * action name.
 */
beforeEach(resetDatabase);

const tag = () => `test.search.${randomUUID().slice(0, 8)}`;

describe("audit metadata (FR-AUD-002)", () => {
  it("records the actor's role and a field-level diff, and the chain still verifies", async () => {
    const admin = await makeUser(["SYSTEM_ADMIN"]);
    const action = tag();
    await recordAudit({
      action,
      entityType: "Test",
      actorId: admin.user.id,
      before: { a: 1, nested: { b: "x" } },
      after: { a: 2, nested: { b: "x" } },
    });
    await recordAudit({ action, entityType: "Test", actorId: null });
    await recordAudit({ action, entityType: "Test", actorId: admin.user.id, actorRole: "AUDITOR" });
    const rows = await db.auditEvent.findMany({ where: { action }, orderBy: { id: "asc" } });
    expect(rows.map((r) => (r.metadata as { actorRole: string }).actorRole)).toEqual([
      "SYSTEM_ADMIN",
      "SYSTEM",
      "AUDITOR",
    ]);
    expect((rows[0]!.metadata as { changes: unknown }).changes).toEqual([
      { field: "a", before: 1, after: 2 },
    ]);
    expect(await verifyAuditChain()).toMatchObject({ ok: true });
  });

  it("stores before/after for configuration proposals and decisions", async () => {
    const maker = await makeUser(["SYSTEM_ADMIN"]);
    const checker = await makeUser(["APPROVING_AUTHORITY"]);
    const current = await getConfig("flags");
    const row = await proposeConfig(
      {
        key: "flags",
        value: { ...current.value, publicPhoto: !current.value.publicPhoto },
        effectiveFrom: "2026-01-01",
        reason: "Board resolution 12/2026",
      },
      maker.user,
      ctx,
    );
    await decideConfig(row.id, true, "Approved", checker.user, ctx);
    const events = await db.auditEvent.findMany({
      where: { entityType: "ConfigVersion", entityId: row.id },
      orderBy: { id: "asc" },
    });
    expect(events.map((e) => e.action)).toEqual(["config.proposed", "config.approved"]);
    for (const event of events)
      expect((event.metadata as { changes: unknown }).changes).toEqual([
        {
          field: "publicPhoto",
          before: current.value.publicPhoto,
          after: !current.value.publicPhoto,
        },
      ]);
    expect(events[1]!.metadata).toMatchObject({
      actorRole: "APPROVING_AUTHORITY",
      status: { before: "PENDING", after: "ACTIVE" },
    });
  });

  it("scopes makers by key: finance may propose fees but not thresholds (FR-ADM-003)", async () => {
    const finance = await makeUser(["FINANCE_OFFICER"]);
    const thresholds = await getConfig("thresholds");
    await expect(
      proposeConfig(
        {
          key: "thresholds",
          value: thresholds.value,
          effectiveFrom: "2026-01-01",
          reason: "Should not be allowed",
        },
        finance.user,
        ctx,
      ),
    ).rejects.toSatisfy((e) => e instanceof AppError && e.code === "forbidden");
    const fees = await getConfig("fees");
    await expect(
      proposeConfig(
        { key: "fees", value: fees.value, effectiveFrom: "2026-01-01", reason: "Gazette 2026/14" },
        finance.user,
        ctx,
      ),
    ).resolves.toMatchObject({ key: "fees", status: "PENDING" });
  });
});

describe("audit search (FR-AUD-004)", () => {
  it("filters by actor name or email, entity or reference, action and date range", async () => {
    const aline = await makeUser(["AUDITOR"], { fullName: "Aline Umutoni" });
    const eric = await makeUser(["REGISTRAR"], { fullName: "Eric Habimana" });
    const action = tag();
    await recordAudit({
      action,
      entityType: "Application",
      entityId: "app-1",
      actorId: aline.user.id,
      metadata: { reference: "REBP-2026-NEW-000777-X" },
    });
    await recordAudit({ action, entityType: "Licence", entityId: "lic-9", actorId: eric.user.id });
    await recordAudit({ action: `${action}.other`, entityType: "Licence", actorId: null });

    const count = async (filters: Parameters<typeof auditWhere>[0]) =>
      db.auditEvent.count({
        where: { AND: [await auditWhere(filters), { action: { startsWith: action } }] },
      });

    expect(await count({})).toBe(3);
    expect(await count({ actor: "umutoni" })).toBe(1);
    expect(await count({ actor: eric.user.email.toUpperCase() })).toBe(1);
    expect(await count({ actor: "nobody-matches-this" })).toBe(0);
    expect(await count({ actor: "system" })).toBe(1);
    expect(await count({ entity: "REBP-2026-NEW-000777" })).toBe(1);
    expect(await count({ entity: "licence" })).toBe(2);
    expect(await count({ entity: "Licence:lic-9" })).toBe(1);
    expect(await count({ action: `${action}.other` })).toBe(1);
    const today = new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10);
    expect(await count({ from: today, to: today })).toBe(3);
    expect(await count({ to: "2020-01-01" })).toBe(0);

    const { events } = await auditTimeline({ filters: { actor: "Aline", action } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorName: "Aline Umutoni", actorRole: "AUDITOR" });
  });

  it("exports the filtered events with a manifest whose hash and signature verify", async () => {
    const auditor = await makeUser(["AUDITOR"]);
    const action = tag();
    for (let i = 0; i < 3; i++)
      await recordAudit({
        action,
        entityType: "Test",
        entityId: String(i),
        actorId: auditor.user.id,
      });

    for (const format of ["csv", "json"] as const) {
      const { body, manifest } = await auditExport({ action }, format, auditor.user.id);
      expect(manifest).toMatchObject({ count: 3, truncated: false, format });
      expect(manifest.chainHead?.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(verifyAuditExport(format, body)).toMatchObject({ ok: true });
    }
    const { body } = await auditExport({ action }, "json", auditor.user.id);
    const ids = (JSON.parse(body).events as Array<{ entityId: string }>).map((e) => e.entityId);
    expect(ids).toEqual(["0", "1", "2"]);
  });
});
