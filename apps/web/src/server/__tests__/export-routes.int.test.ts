import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@rebp/contracts";
import { invalidatePermissionCache } from "@/server/access/permissions";
import type { SessionWithUser } from "@/server/auth/session";
import { verifyAuditExport } from "@/server/audit/export";
import { db } from "@/server/db";
import { resetDatabase } from "@/test/db";
import { makeUser } from "@/test/fixtures";

/**
 * FR-AUD-004 / FR-RPT-005: export routes authorise by capability from the effective matrix (an
 * override takes effect), never by role name, and every export is audited.
 */
const current = vi.hoisted(() => ({ value: null as SessionWithUser | null }));
vi.mock("@/server/auth/current", () => ({ getCurrentSession: async () => current.value }));

const { GET: auditGet } = await import("@/app/api/exports/audit/route");
const { GET: kindGet } = await import("@/app/api/exports/[kind]/route");

beforeEach(async () => {
  await resetDatabase();
  current.value = null;
});

async function signInAs(roles: Role[]) {
  const { user, session } = await makeUser(roles);
  current.value = { user, session };
  return user;
}

const request = (path: string) => new NextRequest(`http://localhost${path}`);
const kind = (name: string) =>
  kindGet(request(`/api/exports/${name}`), {
    params: Promise.resolve({ kind: name }),
  } as Parameters<typeof kindGet>[1]);

describe("audit export route (FR-AUD-004)", () => {
  it("rejects anonymous users and holders of audit.view only", async () => {
    expect((await auditGet(request("/api/exports/audit"))).status).toBe(401);
    await signInAs(["SYSTEM_ADMIN"]); // audit.view, not audit.export
    expect((await auditGet(request("/api/exports/audit"))).status).toBe(403);
  });

  it("serves a verifiable signed export to auditors and audits it", async () => {
    const auditor = await signInAs(["AUDITOR"]);
    const res = await auditGet(request("/api/exports/audit?format=json&action=auth."));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.text();
    const check = verifyAuditExport("json", body);
    expect(check).toMatchObject({ ok: true });
    expect(res.headers.get("x-audit-export-sha256")).toBe(check.ok ? check.manifest.sha256 : "");

    const csv = await auditGet(request("/api/exports/audit"));
    expect(csv.headers.get("content-type")).toMatch(/text\/csv/);
    expect(verifyAuditExport("csv", await csv.text())).toMatchObject({ ok: true });

    const logged = await db.auditEvent.findFirstOrThrow({
      where: { action: "audit.exported", actorId: auditor.id },
      orderBy: { id: "desc" },
    });
    expect(logged.metadata).toMatchObject({ format: "csv", actorRole: "AUDITOR" });
    expect((await auditGet(request("/api/exports/audit?format=xml"))).status).toBe(400);
  });

  it("follows the effective matrix: a granted override opens the export", async () => {
    await signInAs(["REGISTRAR"]);
    expect((await auditGet(request("/api/exports/audit"))).status).toBe(403);
    await db.rolePermission.create({
      data: { role: "REGISTRAR", capability: "audit.export", granted: true },
    });
    invalidatePermissionCache();
    expect((await auditGet(request("/api/exports/audit"))).status).toBe(200);
  });
});

describe("report export routes (FR-RPT-005)", () => {
  it("keeps row-level application exports to staff with reports.view", async () => {
    await signInAs(["APPLICANT", "PRINCIPAL_BROKER"]); // reports.view, no backoffice.access
    expect((await kind("applications")).status).toBe(403);
    expect((await kind("applications-by-reason")).status).toBe(403);
    await signInAs(["REGISTRAR"]);
    expect((await kind("applications")).status).toBe(200);
    const res = await kind("applications-by-reason");
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/^reference,type,category,status,decision,decisionReasons/);
  });

  it("gates payments by payments.view and honours a revoked cell", async () => {
    await signInAs(["AUDITOR"]);
    expect((await kind("payments")).status).toBe(200);
    await db.rolePermission.create({
      data: { role: "AUDITOR", capability: "payments.view", granted: false },
    });
    invalidatePermissionCache();
    expect((await kind("payments")).status).toBe(403);
    expect((await kind("nope")).status).toBe(404);
  });
});
