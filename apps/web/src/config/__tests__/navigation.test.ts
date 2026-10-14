import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { applyOverrides, capabilitiesFor, type PermissionMatrix, type Role } from "@rebp/contracts";
import { isActivePath, mobileTabs, navForArea } from "../navigation";

const hrefs = (area: "portal" | "backoffice", roles: Role[], matrix?: PermissionMatrix) =>
  navForArea(area, capabilitiesFor(roles, matrix)).flatMap((s) =>
    s.items.map((i) => i.href as string),
  );

describe("role-filtered navigation", () => {
  it("shows applicants only their own areas", () => {
    const links = hrefs("portal", ["APPLICANT"]);
    expect(links).toContain("/dashboard");
    expect(links).toContain("/settings/security");
    expect(links).not.toContain("/confirmations");
    expect(links).not.toContain("/backoffice");
  });

  it("adds the confirmation inbox for supervisors and the firm workspace for principals", () => {
    expect(hrefs("portal", ["APPLICANT", "SUPERVISOR"])).toContain("/confirmations");
    expect(hrefs("portal", ["PRINCIPAL_BROKER"])).toEqual(
      expect.arrayContaining(["/confirmations", "/firm"]),
    );
  });

  it("links staff to the back office and limits sections by capability", () => {
    expect(hrefs("portal", ["REVIEWING_OFFICER"])).toContain("/backoffice");
    const officer = hrefs("backoffice", ["REVIEWING_OFFICER"]);
    expect(officer).toContain("/backoffice/queue");
    expect(officer).not.toContain("/backoffice/decisions");
    expect(officer).not.toContain("/backoffice/audit");
    expect(hrefs("backoffice", ["AUDITOR"])).toEqual(
      expect.arrayContaining(["/backoffice/audit", "/backoffice/access"]),
    );
    expect(hrefs("backoffice", ["REVIEWING_OFFICER"])).not.toContain("/backoffice/access");
  });

  it("follows matrix overrides, not just role names", () => {
    const matrix = applyOverrides([
      { role: "REGISTRAR", capability: "reports.view", granted: false },
    ]);
    expect(hrefs("backoffice", ["REGISTRAR"])).toContain("/backoffice/reports");
    expect(hrefs("backoffice", ["REGISTRAR"], matrix)).not.toContain("/backoffice/reports");
  });

  it("gives everyone the My access page", () => {
    expect(hrefs("portal", ["APPLICANT"])).toContain("/settings/access");
  });
});

describe("isActivePath", () => {
  it("matches nested routes unless exact", () => {
    expect(isActivePath("/settings/security", { href: "/settings/security" })).toBe(true);
    expect(isActivePath("/backoffice/queue", { href: "/backoffice", exact: true })).toBe(false);
    expect(isActivePath("/backoffice/queue", { href: "/backoffice/queue" as Route })).toBe(true);
    expect(isActivePath("/register", { href: "/" })).toBe(false);
  });
});

describe("mobileTabs (UX-001)", () => {
  const tabs = (area: "portal" | "backoffice", roles: Role[]) =>
    mobileTabs(navForArea(area, capabilitiesFor(roles))).map((i) => i.href as string);

  it("gives applicants their three primary destinations", () => {
    expect(tabs("portal", ["APPLICANT"])).toEqual(["/dashboard", "/applications", "/licenses"]);
  });

  it("puts the queue first for reviewing officers", () => {
    expect(tabs("backoffice", ["REVIEWING_OFFICER"]).slice(0, 2)).toEqual([
      "/backoffice",
      "/backoffice/queue",
    ]);
  });

  it("tops up roles with few tab-marked areas so the bar is never near-empty", () => {
    expect(tabs("backoffice", ["SYSTEM_ADMIN"])).toHaveLength(3);
  });
});
