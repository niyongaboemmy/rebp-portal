import type { Route } from "next";
import {
  BadgeCheck,
  BarChart3,
  BookUser,
  ClipboardCheck,
  FileStack,
  Gavel,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings2,
  ShieldCheck,
  Wallet,
  Building2,
  KeyRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@rebp/contracts";

/** Keys under the "nav" message namespace. */
export type NavLabelKey =
  | "home"
  | "register"
  | "eligibility"
  | "categories"
  | "dashboard"
  | "applications"
  | "licenses"
  | "confirmations"
  | "firm"
  | "security"
  | "backoffice"
  | "overview"
  | "queue"
  | "decisions"
  | "registerAdmin"
  | "finance"
  | "configuration"
  | "audit"
  | "reports"
  | "portal"
  | "myAccess"
  | "access";

export interface NavItem {
  href: Route;
  label: NavLabelKey;
  icon: LucideIcon;
  /** Hidden unless one of the user's roles grants it (SRS Appendix D). */
  capability?: Capability;
  /** Only highlight on an exact path match (for index routes). */
  exact?: boolean;
}

export interface NavSection {
  label: "sectionApplicant" | "sectionAccount" | "sectionStaff";
  items: NavItem[];
}

export const PUBLIC_NAV: NavItem[] = [
  { href: "/", label: "home", icon: Home, exact: true },
  { href: "/register", label: "register", icon: BookUser },
  { href: "/categories", label: "categories", icon: FileStack },
  { href: "/eligibility", label: "eligibility", icon: ListChecks },
];

export const PORTAL_NAV: NavSection[] = [
  {
    label: "sectionApplicant",
    items: [
      { href: "/dashboard", label: "dashboard", icon: LayoutDashboard },
      { href: "/applications", label: "applications", icon: FileStack },
      { href: "/licenses", label: "licenses", icon: Wallet },
      {
        href: "/confirmations",
        label: "confirmations",
        icon: Inbox,
        capability: "confirmation.decide",
      },
      { href: "/firm", label: "firm", icon: Building2, capability: "firmRoles.manage" },
    ],
  },
  {
    label: "sectionAccount",
    items: [
      { href: "/settings/security", label: "security", icon: ShieldCheck },
      { href: "/settings/access", label: "myAccess", icon: KeyRound },
    ],
  },
];

/** Back-office areas. `milestone` drives the placeholder until the console ships. */
export const BACKOFFICE_SECTIONS = {
  queue: {
    label: "queue",
    icon: ClipboardCheck,
    capability: "review.perform",
    milestone: "D4 — WP-3.1/3.2",
  },
  decisions: {
    label: "decisions",
    icon: Gavel,
    capability: "decision.make",
    milestone: "D4 — WP-3.6",
  },
  register: {
    label: "registerAdmin",
    icon: BadgeCheck,
    capability: "register.administer",
    milestone: "D5 — WP-4.4",
  },
  finance: {
    label: "finance",
    icon: Wallet,
    capability: "payments.manage",
    milestone: "D3 — WP-2.5",
  },
  configuration: {
    label: "configuration",
    icon: Settings2,
    capability: "config.edit",
    milestone: "D5 — WP-4.3",
  },
  reports: {
    label: "reports",
    icon: BarChart3,
    capability: "reports.view",
    milestone: "D5 — WP-4.5",
  },
} as const satisfies Record<
  string,
  { label: NavLabelKey; icon: LucideIcon; capability: Capability; milestone: string }
>;

export type BackofficeSection = keyof typeof BACKOFFICE_SECTIONS;

export const BACKOFFICE_NAV: NavSection[] = [
  {
    label: "sectionStaff",
    items: [
      {
        href: "/backoffice",
        label: "overview",
        icon: LayoutDashboard,
        exact: true,
        capability: "backoffice.access",
      },
      ...Object.entries(BACKOFFICE_SECTIONS).map(([slug, s]) => ({
        href: `/backoffice/${slug}` as Route,
        label: s.label,
        icon: s.icon,
        capability: s.capability,
      })),
      { href: "/backoffice/access", label: "access", icon: UsersRound, capability: "access.view" },
      { href: "/backoffice/audit", label: "audit", icon: ScrollText, capability: "audit.view" },
    ],
  },
  {
    label: "sectionAccount",
    items: [
      { href: "/settings/security", label: "security", icon: ShieldCheck },
      { href: "/settings/access", label: "myAccess", icon: KeyRound },
    ],
  },
];

/** Removes items the user cannot use (by effective capability), and sections left empty. */
export function filterNav(
  sections: NavSection[],
  capabilities: readonly Capability[],
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.capability || capabilities.includes(item.capability),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export function navForArea(
  area: "portal" | "backoffice",
  capabilities: readonly Capability[],
): NavSection[] {
  const sections = filterNav(area === "portal" ? PORTAL_NAV : BACKOFFICE_NAV, capabilities);
  // Cross-links between the applicant portal and the back office.
  if (area === "portal" && capabilities.includes("backoffice.access")) {
    sections.push({
      label: "sectionStaff",
      items: [{ href: "/backoffice", label: "backoffice", icon: ClipboardCheck }],
    });
  }
  if (area === "backoffice") {
    sections.push({
      label: "sectionApplicant",
      items: [{ href: "/dashboard", label: "portal", icon: LayoutDashboard }],
    });
  }
  return sections;
}

export function isActivePath(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  const href = item.href as string;
  if (item.exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
