import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { applyOverrides, capabilitiesFor, type PermissionMatrix, type Role } from "@rebp/contracts";
import {
  activeItem,
  canSwitchArea,
  isActivePath,
  mobileTabs,
  navForArea,
  paletteDestinations,
} from "../navigation";

const hrefs = (area: "portal" | "backoffice", roles: Role[], matrix?: PermissionMatrix) =>
  navForArea(area, capabilitiesFor(roles, matrix)).flatMap((s) =>
    s.items.map((i) => i.href as string),
  );

describe("role-filtered navigation", () => {
  it("shows applicants only their own areas", () => {
    const links = hrefs("portal", ["APPLICANT"]);
    expect(links).toContain("/dashboard");
    expect(links).not.toContain("/settings/security");
    expect(links).not.toContain("/confirmations");
    expect(links).not.toContain("/backoffice");
  });

  it("adds the confirmation inbox for supervisors and the firm workspace for principals", () => {
    expect(hrefs("portal", ["APPLICANT", "SUPERVISOR"])).toContain("/confirmations");
    expect(hrefs("portal", ["PRINCIPAL_BROKER"])).toEqual(
      expect.arrayContaining(["/confirmations", "/firm"]),
    );
  });

  it("lets staff switch areas and limits sections by capability", () => {
    expect(canSwitchArea(capabilitiesFor(["REVIEWING_OFFICER"]))).toBe(true);
    expect(canSwitchArea(capabilitiesFor(["APPLICANT"]))).toBe(false);
    expect(hrefs("portal", ["REVIEWING_OFFICER"])).not.toContain("/backoffice");
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

  it("keeps account pages and the other area reachable from the command palette", () => {
    const applicant = paletteDestinations("portal", capabilitiesFor(["APPLICANT"])).map(
      (i) => i.href as string,
    );
    expect(applicant).toContain("/settings/security");
    expect(applicant).not.toContain("/backoffice");
    // My access is staff-only.
    expect(applicant).not.toContain("/settings/access");
    const officer = paletteDestinations("portal", capabilitiesFor(["REVIEWING_OFFICER"])).map(
      (i) => i.href as string,
    );
    expect(officer).toEqual(expect.arrayContaining(["/backoffice", "/settings/access"]));
  });
});

describe("back-office groups (APP_SHELL_PLAN N2)", () => {
  const groups = (roles: Role[]) =>
    navForArea("backoffice", capabilitiesFor(roles)).map((s) => [
      s.label,
      s.items.map((i) => i.label),
    ]);

  it("puts daily work first and drops groups a role cannot use", () => {
    expect(groups(["REVIEWING_OFFICER"])).toEqual([
      [null, ["overview"]],
      ["sectionWork", ["queue"]],
      ["sectionRegistry", ["finance"]],
      ["sectionInsights", ["reports"]],
    ]);
  });

  it("gives auditors insight and access review", () => {
    const auditor = groups(["AUDITOR"]).map(([label]) => label);
    expect(auditor).toEqual(expect.arrayContaining(["sectionInsights", "sectionAdmin"]));
  });

  it("marks consoles with a count source, except reports", () => {
    const items = navForArea(
      "backoffice",
      capabilitiesFor(["SYSTEM_ADMIN", "APPROVING_AUTHORITY"]),
    ).flatMap((s) => s.items);
    expect(items.find((i) => i.href === "/backoffice/decisions")?.badge).toBe("decisions");
    expect(items.find((i) => i.href === "/backoffice/reports")?.badge).toBeUndefined();
  });
});

describe("activeItem (breadcrumbs)", () => {
  it("picks the deepest matching destination", () => {
    const sections = navForArea("backoffice", capabilitiesFor(["REVIEWING_OFFICER"]));
    expect(activeItem(sections, "/backoffice/queue")?.label).toBe("queue");
    expect(activeItem(sections, "/backoffice")?.label).toBe("overview");
    expect(activeItem(sections, "/backoffice/review/abc")).toBeUndefined();
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
