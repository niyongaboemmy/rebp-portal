import { beforeEach, describe, expect, it } from "vitest";
import type { Role } from "@rebp/contracts";
import { hashPassword } from "@/server/auth/password";
import { signInWithPassword, startLogin } from "@/server/auth/login";
import { createSession, validateSessionToken } from "@/server/auth/session";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { ctx, resetDatabase } from "@/test/db";
import { resetMatrix, saveMatrixChanges } from "../matrix";
import { getPermissionMatrix, getPermissionOverrides, userCan } from "../permissions";
import { listUsers, roleCounts, setUserDisabled, updateUserRoles, USERS_PAGE_SIZE } from "../users";

const PASSWORD = "sunny-kigali-hills-at-dawn";
let passwordHash: string;

async function makeUser(
  email: string,
  roles: Role[],
  extra: Partial<{ accountType: "INDIVIDUAL" | "ORGANISATION"; fullName: string }> = {},
) {
  passwordHash ??= await hashPassword(PASSWORD);
  return db.user.create({
    data: {
      email,
      fullName: extra.fullName ?? email.split("@")[0]!,
      roles,
      accountType: extra.accountType ?? "INDIVIDUAL",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      passwordHash,
    },
  });
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (error) => error instanceof AppError && error.code === code,
  );
}

beforeEach(async () => {
  await resetDatabase();
});

describe("role assignment (SEC-004)", () => {
  it("changes roles, audits the diff and notifies the person", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    const target = await makeUser("aline@x.rw", ["APPLICANT"]);
    const result = await updateUserRoles(
      admin,
      { userId: target.id, roles: ["APPLICANT", "SUPERVISOR"] },
      ctx,
    );
    expect(result.user.roles).toEqual(["APPLICANT", "SUPERVISOR"]);
    expect(result.warnings).toEqual([]);

    const audit = await db.auditEvent.findFirstOrThrow({
      where: { action: "access.roles_changed", entityId: target.id },
    });
    expect(audit.actorId).toBe(admin.id);
    expect(audit.metadata).toMatchObject({ added: ["SUPERVISOR"], removed: [] });
    expect(
      await db.notificationLog.count({
        where: { recipient: target.email, template: "accessChanged" },
      }),
    ).toBe(1);
  });

  it("is a no-op when nothing changes", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    const target = await makeUser("aline@x.rw", ["APPLICANT"]);
    await updateUserRoles(admin, { userId: target.id, roles: ["APPLICANT"] }, ctx);
    expect(
      await db.auditEvent.count({ where: { action: "access.roles_changed", entityId: target.id } }),
    ).toBe(0);
  });

  it("warns about MFA and combined review + decision powers", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    const target = await makeUser("jean@x.rw", ["APPLICANT"]);
    const { warnings } = await updateUserRoles(
      admin,
      { userId: target.id, roles: ["REVIEWING_OFFICER", "APPROVING_AUTHORITY"] },
      ctx,
    );
    expect(warnings).toEqual(["sodCombined", "mfaRequired"]);
  });

  it("refuses self-service changes, staff roles on firm accounts, and removing the last admin", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    const firm = await makeUser("firm@x.rw", ["APPLICANT", "FIRM_ADMIN"], {
      accountType: "ORGANISATION",
    });
    await expectAppError(
      updateUserRoles(admin, { userId: admin.id, roles: ["APPLICANT"] }, ctx),
      "cannotEditOwnAccess",
    );
    await expectAppError(
      updateUserRoles(admin, { userId: firm.id, roles: ["AUDITOR"] }, ctx),
      "staffRoleOnOrganisation",
    );

    const second = await makeUser("admin2@x.rw", ["SYSTEM_ADMIN"]);
    // With two admins, one may demote the other…
    await updateUserRoles(admin, { userId: second.id, roles: ["AUDITOR"] }, ctx);
    // …but the only remaining admin can't be demoted or disabled by someone else.
    const auditor = await db.user.update({
      where: { id: second.id },
      data: { roles: ["SYSTEM_ADMIN", "AUDITOR"] },
    });
    await db.user.update({ where: { id: admin.id }, data: { roles: ["AUDITOR"] } });
    const fresh = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    await expectAppError(
      updateUserRoles(fresh, { userId: auditor.id, roles: ["AUDITOR"] }, ctx),
      "lastAdmin",
    );
    await expectAppError(
      setUserDisabled(fresh, { userId: auditor.id, disabled: true }, ctx),
      "lastAdmin",
    );
  });

  it("rejects an empty role list", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    const target = await makeUser("aline@x.rw", ["APPLICANT"]);
    await expect(updateUserRoles(admin, { userId: target.id, roles: [] }, ctx)).rejects.toThrow();
  });
});

describe("disabling accounts (SEC-011)", () => {
  it("ends sessions, blocks every sign-in path, and can be undone", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    const target = await makeUser("leaver@x.rw", ["REGISTRAR"]);
    const session = await createSession(target, { method: "password", mfaVerified: true });

    const row = await setUserDisabled(
      admin,
      { userId: target.id, disabled: true, reason: "Left the organisation" },
      ctx,
    );
    expect(row).toMatchObject({ disabled: true, disabledReason: "Left the organisation" });
    expect(await validateSessionToken(session.token)).toEqual({ invalid: "revoked" });
    await expectAppError(
      signInWithPassword({ email: target.email, password: PASSWORD }, ctx),
      "accountDisabled",
    );
    const disabled = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    await expectAppError(startLogin(disabled, "google", ctx), "accountDisabled");

    await setUserDisabled(admin, { userId: target.id, disabled: false }, ctx);
    expect((await signInWithPassword({ email: target.email, password: PASSWORD }, ctx)).kind).toBe(
      "session",
    );
    expect(
      await db.auditEvent.count({
        where: {
          entityId: target.id,
          action: { in: ["access.account_disabled", "access.account_enabled"] },
        },
      }),
    ).toBe(2);
  });

  it("invalidates a live session as soon as the account is disabled", async () => {
    const target = await makeUser("x@x.rw", ["APPLICANT"]);
    const session = await createSession(target, { method: "password", mfaVerified: false });
    await db.user.update({ where: { id: target.id }, data: { disabledAt: new Date() } });
    expect(await validateSessionToken(session.token)).toEqual({ invalid: "disabled" });
  });
});

describe("people directory", () => {
  it("searches, filters and paginates", async () => {
    await makeUser("aline@x.rw", ["APPLICANT"], { fullName: "Aline Uwase" });
    await makeUser("jean@x.rw", ["REVIEWING_OFFICER"], { fullName: "Jean Habimana" });
    const off = await makeUser("gone@x.rw", ["APPLICANT"], { fullName: "Gone Person" });
    await db.user.update({ where: { id: off.id }, data: { disabledAt: new Date() } });
    for (let i = 0; i < USERS_PAGE_SIZE; i++)
      await makeUser(`bulk${i}@x.rw`, ["APPLICANT"], { fullName: `Bulk ${i}` });

    expect((await listUsers({ q: "aline" })).items.map((u) => u.email)).toEqual(["aline@x.rw"]);
    expect((await listUsers({ q: "HABIM" })).total).toBe(1);
    expect((await listUsers({ role: "REVIEWING_OFFICER" })).items.map((u) => u.email)).toEqual([
      "jean@x.rw",
    ]);
    expect((await listUsers({ status: "disabled" })).items.map((u) => u.email)).toEqual([
      "gone@x.rw",
    ]);
    expect((await listUsers({ status: "noMfa" })).total).toBe(USERS_PAGE_SIZE + 3);

    const page1 = await listUsers({});
    expect(page1.items).toHaveLength(USERS_PAGE_SIZE);
    expect(page1.pageCount).toBe(2);
    const page2 = await listUsers({ page: 2 });
    expect(page2.items).toHaveLength(3);
    // Disabled accounts sort last.
    expect(page2.items.at(-1)?.email).toBe("gone@x.rw");
    // Out-of-range pages clamp instead of returning nothing.
    expect((await listUsers({ page: 99 })).page).toBe(2);
  });

  it("counts members per role", async () => {
    await makeUser("a@x.rw", ["APPLICANT", "SUPERVISOR"]);
    await makeUser("b@x.rw", ["APPLICANT"]);
    const counts = await roleCounts();
    expect(counts.APPLICANT).toBe(2);
    expect(counts.SUPERVISOR).toBe(1);
    expect(counts.AUDITOR).toBe(0);
  });
});

describe("permission matrix overrides", () => {
  it("applies valid changes immediately and stores only differences from the defaults", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    const registrar = await makeUser("reg@x.rw", ["REGISTRAR"]);
    expect(await userCan(registrar, "audit.export")).toBe(false);

    const result = await saveMatrixChanges(
      admin,
      { changes: [{ role: "REGISTRAR", capability: "audit.export", granted: true }] },
      ctx,
    );
    expect(result.changed).toBe(1);
    expect(await userCan(registrar, "audit.export")).toBe(true);
    expect(await getPermissionOverrides()).toEqual([
      { role: "REGISTRAR", capability: "audit.export", granted: true },
    ]);

    // Reverting the cell removes the override row entirely.
    await saveMatrixChanges(
      admin,
      { changes: [{ role: "REGISTRAR", capability: "audit.export", granted: false }] },
      ctx,
    );
    expect(await db.rolePermission.count()).toBe(0);
    // The audit trail is append-only and shared across runs, so count only this admin's events.
    expect(
      await db.auditEvent.count({
        where: { action: "access.permissions_changed", actorId: admin.id },
      }),
    ).toBe(2);
  });

  it("rejects changes that break segregation of duties, lock-out or staff-only rules", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    await expect(
      saveMatrixChanges(
        admin,
        { changes: [{ role: "REVIEWING_OFFICER", capability: "decision.make", granted: true }] },
        ctx,
      ),
    ).rejects.toMatchObject({
      code: "matrixInvalid",
      meta: { violations: [{ type: "sod", role: "REVIEWING_OFFICER" }] },
    });
    await expectAppError(
      saveMatrixChanges(
        admin,
        { changes: [{ role: "SYSTEM_ADMIN", capability: "roles.manage", granted: false }] },
        ctx,
      ),
      "matrixInvalid",
    );
    await expectAppError(
      saveMatrixChanges(
        admin,
        { changes: [{ role: "APPLICANT", capability: "audit.view", granted: true }] },
        ctx,
      ),
      "matrixInvalid",
    );
    expect(await db.rolePermission.count()).toBe(0);
  });

  it("resets to the defaults", async () => {
    const admin = await makeUser("admin@x.rw", ["SYSTEM_ADMIN"]);
    await saveMatrixChanges(
      admin,
      { changes: [{ role: "AUDITOR", capability: "reports.view", granted: false }] },
      ctx,
    );
    expect((await getPermissionMatrix()).AUDITOR).not.toContain("reports.view");
    expect(await resetMatrix(admin, ctx)).toEqual({ reset: 1 });
    expect((await getPermissionMatrix()).AUDITOR).toContain("reports.view");
  });

  it("ignores stored rows for capabilities that no longer exist", async () => {
    await db.rolePermission.create({
      data: { role: "APPLICANT", capability: "legacy.thing", granted: true },
    });
    expect(await getPermissionOverrides()).toEqual([]);
  });
});
