import type { Route } from "next";
import {
  BookUser,
  FileStack,
  Home,
  KeyRound,
  ListChecks,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "@/components/icons";
// The side navigation draws light Lucide outlines; everything else is Fluent (ADR-009 v8).
import * as Nav from "@/components/icons/nav";
import type { Capability } from "@rebp/contracts";

/** Keys under the "nav" message namespace. */
export type NavLabelKey =
  | "home"
  | "register"
  | "verify"
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
  | "profile"
  | "cv"
  | "access";

/** Destinations that can show a count of what is waiting there (FR-PORTAL-001, FR-RPT-001). */
export type NavBadgeKey =
  | "applications"
  | "queue"
  | "decisions"
  | "register"
  | "finance"
  | "configuration"
  | "confirmations";
export type NavBadges = Partial<Record<NavBadgeKey, number>>;

export interface NavItem {
  href: Route;
  label: NavLabelKey;
  icon: LucideIcon;
  /** Hidden unless one of the user's roles grants it (SRS Appendix D). */
  capability?: Capability;
  /** Also shown to holders of any of these (e.g. checkers who approve what the console proposes). */
  alsoFor?: readonly Capability[];
  /** Only highlight on an exact path match (for index routes). */
  exact?: boolean;
  /** Shown as a bottom-bar tab on phones (max three per area; the rest live under "More"). */
  tab?: boolean;
  /** Count shown next to the item when something is waiting. */
  badge?: NavBadgeKey;
  /** Profile: people only (not organisations). CV: individual applicants only. */
  audience?: "person" | "applicant";
}

export type NavSectionLabel =
  "sectionWork" | "sectionRegistry" | "sectionInsights" | "sectionAdmin";

export interface NavSection {
  /** `null`: the area's home group, shown without a heading. */
  label: NavSectionLabel | null;
  items: NavItem[];
}

export type AppArea = "portal" | "backoffice";

export const PUBLIC_NAV: NavItem[] = [
  { href: "/", label: "home", icon: Home, exact: true },
  { href: "/register", label: "register", icon: BookUser },
  { href: "/check", label: "verify", icon: ShieldCheck },
  { href: "/categories", label: "categories", icon: FileStack },
  { href: "/eligibility", label: "eligibility", icon: ListChecks },
];

export const PORTAL_NAV: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "dashboard", icon: Nav.LayoutDashboard, tab: true },
      {
        href: "/applications",
        label: "applications",
        icon: Nav.FileStack,
        tab: true,
        badge: "applications",
      },
      { href: "/licenses", label: "licenses", icon: Nav.IdCard, tab: true },
      {
        href: "/confirmations",
        label: "confirmations",
        icon: Nav.Inbox,
        capability: "confirmation.decide",
        badge: "confirmations",
      },
      { href: "/firm", label: "firm", icon: Nav.Building2, capability: "firmRoles.manage" },
    ],
  },
];

/** Back-office consoles. `milestone` is the delivery-plan reference for developers (never shown to users). */
export const BACKOFFICE_SECTIONS = {
  queue: {
    label: "queue",
    icon: Nav.ClipboardCheck,
    capability: "review.perform",
    // Leads who take over or bulk-assign files see the queue too (the page admits either).
    alsoFor: ["review.assign"],
    group: "sectionWork",
    milestone: "D4 — WP-3.1/3.2",
  },
  decisions: {
    label: "decisions",
    icon: Nav.Gavel,
    capability: "decision.make",
    group: "sectionWork",
    milestone: "D4 — WP-3.6",
  },
  register: {
    label: "registerAdmin",
    icon: Nav.BadgeCheck,
    capability: "register.administer",
    alsoFor: ["register.revoke"],
    group: "sectionRegistry",
    milestone: "D5 — WP-4.4",
  },
  finance: {
    label: "finance",
    icon: Nav.Wallet,
    capability: "payments.manage",
    alsoFor: ["payments.view"],
    group: "sectionRegistry",
    milestone: "D3 — WP-2.5",
  },
  configuration: {
    label: "configuration",
    icon: Nav.Settings2,
    capability: "config.edit",
    alsoFor: ["config.approve"],
    group: "sectionAdmin",
    milestone: "D5 — WP-4.3",
  },
  reports: {
    label: "reports",
    icon: Nav.BarChart3,
    capability: "reports.view",
    group: "sectionInsights",
    milestone: "D5 — WP-4.5",
  },
} as const satisfies Record<
  string,
  {
    label: NavLabelKey;
    icon: LucideIcon;
    capability: Capability;
    alsoFor?: readonly Capability[];
    group: NavSectionLabel;
    milestone: string;
  }
>;

export type BackofficeSection = keyof typeof BACKOFFICE_SECTIONS;

const consoleItem = (slug: BackofficeSection): NavItem => {
  const s: (typeof BACKOFFICE_SECTIONS)[BackofficeSection] = BACKOFFICE_SECTIONS[slug];
  return {
    href: `/backoffice/${slug}` as Route,
    label: s.label,
    icon: s.icon,
    capability: s.capability,
    alsoFor: "alsoFor" in s ? s.alsoFor : undefined,
    tab: slug === "queue" || slug === "decisions",
    badge: slug === "reports" ? undefined : slug,
  };
};

/**
 * Back office, grouped by kind of work (APP_SHELL_PLAN N2): daily work first, records, read-mostly
 * insight, then rare and sensitive administration.
 */
export const BACKOFFICE_NAV: NavSection[] = [
  {
    label: null,
    items: [
      {
        href: "/backoffice",
        label: "overview",
        icon: Nav.LayoutDashboard,
        exact: true,
        capability: "backoffice.access",
        tab: true,
      },
    ],
  },
  { label: "sectionWork", items: [consoleItem("queue"), consoleItem("decisions")] },
  { label: "sectionRegistry", items: [consoleItem("register"), consoleItem("finance")] },
  {
    label: "sectionInsights",
    items: [
      consoleItem("reports"),
      { href: "/backoffice/audit", label: "audit", icon: Nav.ScrollText, capability: "audit.view" },
    ],
  },
  {
    label: "sectionAdmin",
    items: [
      consoleItem("configuration"),
      {
        href: "/backoffice/access",
        label: "access",
        icon: Nav.UsersRound,
        capability: "access.view",
      },
    ],
  },
];

/** Personal settings: reached from the account menu and the command palette, not the main nav. */
export const ACCOUNT_LINKS: NavItem[] = [
  { href: "/settings/profile" as Route, label: "profile", icon: UserRound, audience: "person" },
  // The applicant's CV: education, training and experience (UX-018).
  { href: "/settings/cv" as Route, label: "cv", icon: BookUser, audience: "applicant" },
  { href: "/settings/security", label: "security", icon: ShieldCheck },
  {
    href: "/settings/access",
    label: "myAccess",
    icon: KeyRound,
    // Staff only: applicants' permissions are fixed, so the page would only explain the obvious.
    capability: "backoffice.access",
  },
];

/** The account links this person may open (My access is for staff). */
export function accountLinksFor(
  capabilities: readonly Capability[],
  /** Who the person is: every person keeps a profile; only individual applicants a CV. */
  kind: { person: boolean; applicant: boolean } = { person: true, applicant: true },
): NavItem[] {
  return ACCOUNT_LINKS.filter(
    (item) => canSee(item, capabilities) && (!item.audience || kind[item.audience]),
  );
}

/** Each area's home, for the area switcher. */
export const AREA_HOME: Record<AppArea, NavItem> = {
  portal: { href: "/dashboard", label: "portal", icon: Nav.LayoutDashboard },
  backoffice: { href: "/backoffice", label: "backoffice", icon: Nav.ClipboardCheck },
};

/** Staff can move between the applicant portal and the back office. */
export function canSwitchArea(capabilities: readonly Capability[]): boolean {
  return capabilities.includes("backoffice.access");
}

/** Whether a nav item or console is available to someone with these capabilities. */
export function canSee(
  item: { capability?: Capability; alsoFor?: readonly Capability[] },
  capabilities: readonly Capability[],
): boolean {
  if (!item.capability) return true;
  return [item.capability, ...(item.alsoFor ?? [])].some((c) => capabilities.includes(c));
}

/** Removes items the user cannot use (by effective capability), and sections left empty. */
export function filterNav(
  sections: NavSection[],
  capabilities: readonly Capability[],
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canSee(item, capabilities)),
    }))
    .filter((section) => section.items.length > 0);
}

/** The area's service navigation (ADR-011). Account links and the area switch live elsewhere. */
export function navForArea(area: AppArea, capabilities: readonly Capability[]): NavSection[] {
  return filterNav(area === "portal" ? PORTAL_NAV : BACKOFFICE_NAV, capabilities);
}

/** Everything the command palette can jump to: the area's nav, the other area, account pages. */
export function paletteDestinations(area: AppArea, capabilities: readonly Capability[]): NavItem[] {
  const other = area === "portal" ? "backoffice" : "portal";
  return [
    ...navForArea(area, capabilities).flatMap((section) => section.items),
    ...(canSwitchArea(capabilities) ? [AREA_HOME[other]] : []),
    ...accountLinksFor(capabilities),
  ];
}

export function isActivePath(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  const href = item.href as string;
  if (item.exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The nav item a path belongs to (the longest matching href), for breadcrumbs. */
export function activeItem(sections: NavSection[], pathname: string): NavItem | undefined {
  return sections
    .flatMap((section) => section.items)
    .filter((item) => isActivePath(pathname, item))
    .sort((a, b) => (b.href as string).length - (a.href as string).length)[0];
}

/**
 * Bottom-bar tabs for phones (UX-001): up to three destinations the user can reach — tab-marked
 * items first, topped up with their other destinations so no role gets a near-empty bar.
 */
export function mobileTabs(sections: NavSection[]): NavItem[] {
  const items = sections.flatMap((section) => section.items);
  const marked = items.filter((item) => item.tab);
  const rest = items.filter((item) => !item.tab);
  return [...marked, ...rest].slice(0, 3);
}
