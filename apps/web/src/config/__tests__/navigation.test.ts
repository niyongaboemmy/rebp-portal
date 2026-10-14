import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { isActivePath, navForArea } from "../navigation";

const hrefs = (area: "portal" | "backoffice", roles: Parameters<typeof navForArea>[1]) =>
  navForArea(area, roles).flatMap((s) => s.items.map((i) => i.href as string));

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
    expect(hrefs("backoffice", ["AUDITOR"])).toContain("/backoffice/audit");
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
