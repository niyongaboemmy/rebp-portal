# App Shell — Development Implementation Plan

| Item        | Value                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Document ID | REBP-PORTAL-UX-003-IMPL                                                                                    |
| Version     | 1.0                                                                                                        |
| Date        | 2026-10-16                                                                                                 |
| Design      | [APP_SHELL_PLAN.md](APP_SHELL_PLAN.md): the review findings (A1–A6, N1–N7, T1–T4, U1–U4) and target design |
| Refs        | UX-001, UX-003, FR-PORTAL-001, FR-RPT-001, NFR-USE, NFR-PERF-005, WCAG 2.2 AA                              |
| Audience    | Front-end engineers building the shell                                                                     |
| Effort      | About 10 dev-days for one engineer, or about 6 calendar days for two (see §3)                              |

The design plan says _what_ and _why_. This document says _how, in what order, and how we know each step is done_.
Every phase ends in one PR that is releasable on its own. Finding IDs (e.g. `A2`) point back to the design plan.

---

## 1. Ground rules for this work

- **One PR per phase**, on a branch off `feat/pilot-delivery`, named `feat/shell-pN-<slug>`. Commit subjects cite IDs,
  for example `feat(shell): UX-001 collapsible sidebar primitive (N1)`.
- **Hot files.** These files are also edited by parallel sessions: `app-shell.tsx`, `config/navigation.ts`,
  `globals.css`, `messages/*.json`, `components/ui/*` and `e2e/*`. Before starting each phase:
  1. Check `ListAgents` and `git status` for activity on those files.
  2. Announce the phase's file list to any active `rebp-portal-*` session.
  3. Rebase.

  In `globals.css`, append each phase's CSS in its own clearly fenced block (`/* ── shell: … ── */`) to keep merges
  trivial.

- **No new npm packages.** The sidebar primitive is copied-in code built on Radix pieces we already ship (Slot,
  Tooltip, Dialog via `Sheet`, DropdownMenu). The `minimumReleaseAge` and `allowBuilds` policy stays untouched.
- **Conventions that apply throughout** (CLAUDE.md):
  - Client components import nav config themselves; only plain data (strings, numbers, booleans) crosses from server
    to client.
  - Every new string goes into `messages/en.json`, with drafts in `rw`/`fr`.
  - Pages keep their own `requireUser()` / `requireCapability()` guards, because this work changes layouts only.
- **Gate for every PR**:
  - `pnpm lint && pnpm typecheck && pnpm test` pass.
  - `pnpm test:e2e` passes for `desktop` and `mobile`.
  - axe reports no new violations.
  - Screenshots attached for 375, 1024 and 1440 px, light and dark.

---

## 2. Phase overview

| Phase  | PR                     | Delivers                                                                                                                    | Fixes                   | Effort   | Depends on                       |
| ------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------- | -------------------------------- |
| **P0** | `shell-p0-foundations` | ADR-011, `ShellPrefs` contract and cookie helpers, layout tokens, Tailwind custom variants, baseline screenshots            | —                       | 1 day    | —                                |
| **P1** | `shell-p1-sidebar`     | `ui/sidebar.tsx` primitive and the `/dev/shell` playground                                                                  | N1, A5                  | 2 days   | P0                               |
| **P2** | `shell-p2-layout`      | New `AppShell`: grid, inset panel, full-height sidebar, banner inside the panel, calm canvas, content width, scroll padding | A1–A6, N4, N7           | 1.5 days | P1                               |
| **P3** | `shell-p3-nav-ia`      | Grouped back office, area switcher, account links removed from the nav, live badges                                         | N2, N3, N5, N6          | 1 day    | P2                               |
| **P4** | `shell-p4-topbar`      | `TopBar`, breadcrumbs, centred search, help, scroll-driven hairline                                                         | T1–T4                   | 1 day    | P2                               |
| **P5** | `shell-p5-account`     | Sidebar user card, `AccountMenu` / `AccountSheet`, curated avatar palette, slimmer More sheet                               | U1–U4                   | 1.5 days | P2 (P3 for the area switch item) |
| **P6** | `shell-p6-adaptive`    | Container-query migration, medium-tier modal sidebar, density and width preferences                                         | §2.5 of the design plan | 1 day    | P2                               |
| **P7** | `shell-p7-hardening`   | `shell.spec.ts`, viewport matrix, visual regression, fr/rw overflow run, docs and CLAUDE.md updates                         | —                       | 1 day    | P3–P6                            |

```
P0 ─► P1 ─► P2 ─┬─► P3 ─┐
                ├─► P4 ─┤
                ├─► P5 ─┼─► P7
                └─► P6 ─┘
```

After P2 the product already looks and behaves like the new shell with today's navigation. P3–P6 are independent
improvements and can merge in any order. P5 adds its "Switch area" item only if P3 has merged.

---

## 3. Schedule

| Day | Engineer A                     | Engineer B                                                          |
| --- | ------------------------------ | ------------------------------------------------------------------- |
| 1   | P0 foundations                 | P0: baseline screenshots, ADR-011 draft                             |
| 2–3 | P1 sidebar primitive           | P6 prep: container-query mapping and conversion list (no merge yet) |
| 4   | P2 layout (merge end of day 5) | P2 review, then P4 top bar (breadcrumb model)                       |
| 5   | P2 finish → **merge**          | P4 finish → merge after P2                                          |
| 6   | P3 nav IA                      | P5 account menu                                                     |
| 7   | P6 adaptive and preferences    | P5 finish                                                           |
| 8   | P7 hardening                   | P7 locale and visual runs                                           |

For one engineer, do the phases in order P0 → P7, which takes about 10 days.

---

## 4. Phases in detail

### P0 — Foundations (1 day)

**Goal:** every later phase can rely on the decisions, tokens, preference plumbing and a visual baseline.

| ID   | Task                                                                                                                                                                                                                                                                                                                                                                                     | Files                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| P0.1 | Write **ADR-011 "Authenticated shell"**, amending UI_MODERNIZATION_PLAN §6.1. It records: the inset layout; the four tiers; the sidebar inside document scroll; the preference cookie; the banner inside the panel; account controls moving to the sidebar footer at ≥ md; and that theme leaves the top bar. Add it to `docs/adr/README.md`.                                            | `docs/adr/ADR-011-app-shell.md`, `docs/adr/README.md`                    |
| P0.2 | Add the **`ShellPrefs` contract** (below), export it from the index, and add unit tests: defaults, an unknown value falls back to the default, and a malformed cookie gives defaults.                                                                                                                                                                                                    | `packages/contracts/src/shell.ts`, `index.ts`, `__tests__/shell.test.ts` |
| P0.3 | Add **server and client cookie helpers**. `readShellPrefs()` is server-only and uses `cookies()` plus `safeParse`. `writeShellPrefs(patch)` is a client function that merges, serialises and sets the cookie with `path=/; max-age=31536000; samesite=lax`. Don't use a server action: the preferences are cosmetic and need no round trip.                                              | `src/server/shell-prefs.ts`, `src/lib/shell-prefs-client.ts`             |
| P0.4 | Add the **layout tokens** to `:root`: `--sidebar-w`, `--sidebar-w-icon`, `--header-h`, `--content-max-default`, `--content-max-wide` and `--content-max`. Shift the `--sidebar` lightness so the sidebar sits one step dimmer than `--background` in light mode and one step lighter in dark mode. Re-run the `tokens.test.ts` contrast pairs for `--sidebar-foreground` on `--sidebar`. | `src/app/globals.css`, `src/lib/__tests__/tokens.test.ts`                |
| P0.5 | Add the **custom variants** `sb-collapsed` and `sb-expanded` (below). Every later phase styles the collapsed state with them, never with JS.                                                                                                                                                                                                                                             | `src/app/globals.css`                                                    |
| P0.6 | Capture **baseline screenshots** of the current shell (dashboard, back-office overview, queue) at 375, 768, 1024, 1280 and 1920 px in light and dark. Attach them to the P0 PR so reviewers can compare later PRs against them. These are not committed as snapshots.                                                                                                                    | `e2e/shell-baseline.spec.ts` (temporary, deleted in P7)                  |

```ts
// packages/contracts/src/shell.ts — viewer layout preferences (UX-001). Cosmetic, no PII.
import { z } from "zod";

export const SHELL_PREFS_COOKIE = "rebp_shell";

export const ShellPrefs = z.object({
  sidebar: z.enum(["auto", "expanded", "collapsed"]).catch("auto"),
  density: z.enum(["comfortable", "compact"]).catch("comfortable"),
  width: z.enum(["default", "full"]).catch("default"),
});
export type ShellPrefs = z.infer<typeof ShellPrefs>;
export const DEFAULT_SHELL_PREFS: ShellPrefs = ShellPrefs.parse({});
```

```css
/* ── shell: sidebar state variants ──
   Collapsed when: medium tier (always), or the user pinned it collapsed, or auto below xl.
   The cookie value is on the shell root as data-sidebar; no JS is needed for the first paint. */
@custom-variant sb-collapsed {
  @media (width >= 48rem) and (width < 64rem) {
    &:where([data-sidebar] *) {
      @slot;
    }
  }
  @media (width >= 64rem) {
    &:where([data-sidebar="collapsed"] *) {
      @slot;
    }
  }
  @media (width >= 64rem) and (width < 80rem) {
    &:where([data-sidebar="auto"] *) {
      @slot;
    }
  }
}
@custom-variant sb-expanded {
  @media (width >= 64rem) {
    &:where([data-sidebar="expanded"] *) {
      @slot;
    }
  }
  @media (width >= 80rem) {
    &:where([data-sidebar="auto"] *) {
      @slot;
    }
  }
}
```

**Done when:**

- The contract tests are green.
- Token contrast is green.
- A throwaway element using `sb-collapsed:bg-red-500` turns red at 900 px, and at 1100 px only when `data-sidebar="auto"`.

---

### P1 — Sidebar primitive (2 days)

**Goal:** a single, accessible sidebar component that renders the nav once and handles both states, the cookie, the
keyboard shortcut and tooltips.

| ID    | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1.1  | **`SidebarProvider`** (client). Props: `initialMode: ShellPrefs["sidebar"]`. State: `mode`, `mobileOpen`. It renders the shell root `<div data-sidebar={mode}>`, so the server's first paint and the client agree. `toggle()` does the following: at < 64rem it opens the sheet (`mobileOpen`). Otherwise it reads the **resolved** state from `matchMedia("(min-width: 80rem)")` combined with `mode`, sets the explicit opposite and calls `writeShellPrefs({ sidebar })`. It also exposes `reset()`, which goes back to `auto`.                      |
| P1.2  | **Keyboard:** ⌘B / Ctrl+B calls `toggle()`. It's ignored when `event.target` is an input, textarea, select or `[contenteditable]`, or when `event.defaultPrevented`. Register one listener in the provider. Add `aria-keyshortcuts="Meta+B Control+B"` to the trigger.                                                                                                                                                                                                                                                                                  |
| P1.3  | **Slots:** `Sidebar` (the `<aside id="app-sidebar">`; sticky `top-0 h-dvh`; `w-(--sidebar-w-icon)` with `sb-expanded:w-(--sidebar-w)`; `transition-[width] duration-(--dur-3)`; hidden below md). Also `SidebarHeader` (`h-(--header-h)`, which matches the top bar), `SidebarContent` (`flex-1 overflow-y-auto overscroll-contain`), `SidebarFooter`, `SidebarGroup` and `SidebarGroupLabel` (sentence case, 12 px, `sb-collapsed:sr-only`; the group keeps its `role="group"` and `aria-labelledby`).                                                 |
| P1.4  | **`SidebarMenuButton`**: wraps `next/link`, takes `item`, `active` and `badge?`. Its label `<span>` is `sb-collapsed:sr-only`. Collapsed, it renders inside `Tooltip` (`side="right"`, `delayDuration={300}`) whose content is the label plus the count. The tooltip is always mounted, but its content is hidden with `sb-expanded:hidden`, so there is no JS branch. Style: 40 px tall, 44 px under `pointer: coarse`; 10 px radius; the active state is `bg-sidebar-accent` with a semibold label and a `text-link` icon. **No indicator bar** (N4). |
| P1.5  | **`SidebarMenuBadge`**: a count pill when expanded and a 6 px dot when collapsed. It renders `aria-hidden`; the count goes into the link's accessible name through `t("nav.badge.<key>", { count })` in a visually hidden span.                                                                                                                                                                                                                                                                                                                         |
| P1.6  | **`SidebarTrigger`** (◧): `aria-controls="app-sidebar"` and `aria-expanded` from the resolved state. Its label is `nav.collapseSidebar` or `nav.expandSidebar`, and its tooltip shows the shortcut. **`SidebarRail`**: a 6 px `aria-hidden` button on the inner edge that calls `toggle()`, has `tabIndex={-1}` and uses `cursor-ew-resize`.                                                                                                                                                                                                            |
| P1.7  | **Medium-tier sheet:** while `mobileOpen` is true, render `Sheet side="left"` with the same `SidebarHeader`/`SidebarContent`/`SidebarFooter` content forced to expanded (wrap it in `data-sidebar="expanded"`). It closes on navigation (on a `usePathname` change) and on Esc, and returns focus to the trigger (Radix does this).                                                                                                                                                                                                                     |
| P1.8  | **Rebuild `AppNav`** on the primitive: one `<nav aria-label="Main navigation">` with groups and `SidebarMenuButton`s. Delete `variant="rail"` from `AppNav` and `NavLink`. `NavLink` keeps only the `header` variant used by the public header.                                                                                                                                                                                                                                                                                                         |
| P1.9  | **Playground** at `src/app/dev/shell/page.tsx` (dev-only, like `dev/design`). It shows the primitive with fake nav, badges, long fr/rw labels and a mode switcher. Reviewers use it, and P7's visual tests target it.                                                                                                                                                                                                                                                                                                                                   |
| P1.10 | **Unit tests** (Vitest + Testing Library): the toggle writes the cookie; ⌘B is ignored inside an input; `reset()` goes back to auto; collapsed buttons keep their accessible name; the badge count is in the accessible name.                                                                                                                                                                                                                                                                                                                           |

**Not in P1:** wiring into `AppShell`. The primitive is merged unused apart from the playground, which keeps the PR
reviewable and risk-free.

**Done when:**

- The playground works at 900, 1100 and 1400 px.
- Reloading in each mode shows the correct state on first paint (Playwright: CLS = 0 with
  `PerformanceObserver('layout-shift')`).
- Tooltips appear on keyboard focus.
- The unit tests are green.

---

### P2 — Layout (1.5 days)

**Goal:** switch both areas to the new shell, keeping today's navigation items.

| ID   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2.1 | **Rewrite `AppShell`** (server). It reads `readShellPrefs()` and `userCapabilities()` in parallel, then renders the structure below. Keep `viewTransitionName` on the sidebar (`app-sidebar`), top bar (`app-header`) and bottom nav. The old header markup moves into a temporary `<TopBar>` that matches today's contents; P4 rebuilds it.                                                                                                                                                                                                                                            |
| P2.2 | **Full-height sidebar (A2):** move `<PilotBanner>` inside the content panel, above the top bar. The sidebar is no longer below anything, so `sticky top-0 h-dvh` is correct. On phones the banner still spans the screen, because the panel is the screen.                                                                                                                                                                                                                                                                                                                              |
| P2.3 | **Aligned rows (A3):** `SidebarHeader` and the top bar are both `h-(--header-h)`. The logo renders once, with its wordmark hidden by `sb-collapsed:hidden`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P2.4 | **Calm canvas (A1, A6):** delete the two ambient `<div>`s from `AppShell`. The dashboard greeting gets its wash back by opting into it (`<PageHero tone="soft">`, or the existing ambient utility on its own header block).                                                                                                                                                                                                                                                                                                                                                             |
| P2.5 | **Content width (A4) without wrapping every page:** `main` gets `mx-auto w-full max-w-(--content-max) px-4 sm:px-6 lg:px-8`. CSS rules set the variable: `main { --content-max: var(--content-max-default) }`, `main:has([data-page-width="wide"]) { --content-max: var(--content-max-wide) }` and `[data-width="full"] main { --content-max: none }`. Add `<PageWidth wide />`, a tiny server component that renders `<span hidden data-page-width="wide" />`. Use it in the queue, decisions, register, finance, configuration, access, audit and reports pages and in `review/[id]`. |
| P2.6 | **Focus not obscured (WCAG 2.4.11):** add `html { scroll-padding-top: calc(var(--header-h) + 0.5rem); scroll-padding-bottom: var(--bottom-nav-h, 0px); }`.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P2.7 | **Section labels (N7):** these come from `SidebarGroupLabel`. Delete the old uppercase classes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| P2.8 | **E2E:** update anything that relied on the old rail (`AppNav variant="rail"`). Add assertions that, at 1440 px, the sidebar's bottom edge is ≤ the viewport height at scroll 0 with the banner shown, and that the logo row and top bar `boundingBox().y` and `height` are equal ±1 px.                                                                                                                                                                                                                                                                                                |

```tsx
// app-shell.tsx: structure only
<SidebarProvider initialMode={prefs.sidebar}>                 {/* renders <div data-sidebar=…> */}
  <div data-density={prefs.density} data-width={prefs.width}
       className="grid min-h-dvh bg-sidebar md:grid-cols-[auto_minmax(0,1fr)]">
    <Sidebar>
      <SidebarHeader><Logo /></SidebarHeader>
      <SidebarContent><AppNav area={area} capabilities={capabilities} /></SidebarContent>
      <SidebarFooter>{/* P5: user card */}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
    <div className="flex min-w-0 flex-col md:py-2 md:pr-2">
      <div className="@container/main flex flex-1 flex-col bg-background md:rounded-2xl md:border md:border-border/60">
        <PilotBanner />
        <TopBar area={area} capabilities={capabilities} user={user} />
        <main id="main" className="…">{children}</main>
      </div>
    </div>
    <BottomNav … />
  </div>
</SidebarProvider>
```

**Risks:**

- The `md:py-2` gap means the sticky top bar sticks at 0 inside the panel while the panel has an 8 px top margin. On
  scroll the bar overlaps that margin, which is intended: the panel's top radius scrolls away and the bar becomes flush.
  Confirm this with design. If it's unwanted, set `top-2` on the bar plus a background strip.
- `:has()` is Baseline 2023, so supported. Without it the page simply uses the default width.

**Done when:**

- Every portal and back-office page renders in the new shell at all five widths.
- The existing e2e suite is green.
- Screenshots show one sidebar plane and one content plane.

---

### P3 — Navigation IA and badges (1 day)

| ID   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3.1 | **Group the back office (N2)** in `navigation.ts`. Extend `NavSection.label` to include `"sectionWork" \| "sectionRegistry" \| "sectionInsights" \| "sectionAdmin"`, and allow `label: null` for the unlabelled Overview group. Groups: Overview · Work (Queue, Decisions) · Registry (Register, Finance) · Insights (Reports, Audit) · Admin (Configuration, Access). Keep `BACKOFFICE_SECTIONS`, but add a `group` field to each entry and build `BACKOFFICE_NAV` from it.                                                                    |
| P3.2 | **Remove the cross-links (N5)** from `navForArea()`. Add a `canSwitchArea(capabilities)` helper (true when the user has `backoffice.access`). Build **`AreaSwitcher`** (client) in `SidebarHeader` under the logo: a `DropdownMenu` with two `DropdownMenuRadioItem`s, "Applicant portal" → `/dashboard` and "Back office" → `/backoffice`. When collapsed it shows the area icon with a tooltip. In the medium-tier sheet and the phone More sheet it renders as two segmented links.                                                          |
| P3.3 | **Account items out (N6):** remove `sectionAccount` from both trees, and delete the `sectionStaff` and `sectionAccount` labels if nothing else uses them. The **command palette** reads `navForArea()`, so add an explicit `ACCOUNT_LINKS` export (Security, My access) and include it in the palette's commands. Add `LinkTabs` (Security · My access) to both `/settings/*` pages.                                                                                                                                                            |
| P3.4 | **Badges (N3):** add `badge?: BadgeKey` to `NavItem`, with `BadgeKey = "queue" \| "decisions" \| "register" \| "finance" \| "confirmations"`. On the server, `AppShell` calls a new `navBadges(user, capabilities, area)` that returns `Partial<Record<BadgeKey, number>>`. For the back office it reuses `consoleCounts()`; for the portal it calls a new `pendingConfirmationCount(userId)` in `server/confirmations` (a `count()` query, not the full inbox). Wrap both in React `cache()`. Pass the result to the client as a plain object. |
| P3.5 | **Freshness:** after server actions that change a count (assign, decide, confirm, register action, payment), the client's `useActionForm` success path calls `router.refresh()`. Most already navigate, so audit the handful that don't. No polling.                                                                                                                                                                                                                                                                                            |
| P3.6 | **Phone tabs:** the back office keeps Overview · Queue · Decisions (already `tab: true`), now with badge dots. `mobileTabs()` is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                     |
| P3.7 | **i18n:** add `nav.sectionWork/Registry/Insights/Admin`, `nav.areaSwitch`, `nav.areaPortal`, `nav.areaBackoffice` and `nav.badge.{queue,decisions,register,finance,confirmations}` ("{count} waiting" and similar, ICU plural) to `en.json`, with drafts in `rw` and `fr`.                                                                                                                                                                                                                                                                      |
| P3.8 | **Tests:** a unit test runs `navForArea()` for each seeded role (reviewer, decision-maker, finance, admin, applicant, firm admin) and asserts the groups, plus that empty groups are dropped. An e2e test checks that a reviewer with one assigned application sees "Work queue, 1 waiting" in the nav's accessible name. The existing RBAC nav test stays green.                                                                                                                                                                               |

**Done when:**

- Each role's sidebar matches the design plan's table.
- The palette still reaches Security and My access.
- Badge counts are correct after an assign or decide action without a manual reload.

---

### P4 — Top bar and breadcrumbs (1 day)

| ID   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4.1 | **`TopBar`** (`layout/top-bar.tsx`, server wrapper with client islands). It is `sticky top-0 z-30 h-(--header-h)` with an opaque `bg-background` and no `backdrop-blur`. Slots at ≥ md: `SidebarTrigger` · `Breadcrumbs` · `CommandPalette` (`flex-1 max-w-md mx-auto`) · `LanguageSwitcher` · `NotificationBell` · `HelpButton`. Below md: `Logo` · search icon · bell · account avatar (P5).                                                                                                                                                                        |
| P4.2 | **`Breadcrumbs`** (client). It resolves the trail from `usePathname()` and the nav config: area root ("Back office" or "Portal"), then the matched nav item (`isActivePath`), then an optional **tail**. The tail is set by the page through `<BreadcrumbTail label="REBP-2026-NEW-000001-1" />`, a client component that writes to a context in `TopBar`. It renders `<nav aria-label={t("nav.breadcrumb")}><ol>…`, with `aria-current="page"` on the last item. Overflow: below 1280 px, middle items collapse into an `…` dropdown. Labels truncate at `max-w-48`. |
| P4.3 | **Migrate the inline breadcrumbs** in `backoffice/review/[id]`, `applications/[id]`, `licenses/[id]` and `pay/[reference]` to `<BreadcrumbTail>`, and delete their local breadcrumb markup.                                                                                                                                                                                                                                                                                                                                                                           |
| P4.4 | **Theme leaves the bar (T3).** `ThemeToggle` is no longer rendered in `TopBar`. P5 adds theme to the account menu. If P5 merges after P4, keep `ThemeToggle` until then and remove it in P5.                                                                                                                                                                                                                                                                                                                                                                          |
| P4.5 | **`HelpButton`**: a `?` icon button that opens the existing help sheet, or links to `/help` if that's what exists. It sits in the same place on every page (WCAG 3.2.6, Consistent Help).                                                                                                                                                                                                                                                                                                                                                                             |
| P4.6 | **Scroll hairline (T4)** in CSS only: `@supports (animation-timeline: scroll()) { .top-bar { animation: bar-edge linear both; animation-timeline: scroll(root); animation-range: 0 24px; } }`, with `@keyframes bar-edge { to { border-bottom-color: var(--border) } }`. The fallback is a permanent hairline. The public `HeaderShell` is untouched.                                                                                                                                                                                                                 |
| P4.7 | **Tests:** e2e checks that `/backoffice/review/<id>` shows "Back office › Work queue › <reference>" and that the middle link navigates. At 1024 px with the sidebar expanded, the top bar is one line (height === `--header-h`).                                                                                                                                                                                                                                                                                                                                      |

**Done when:**

- Every authenticated page has a breadcrumb or title in the bar.
- No inline breadcrumb markup remains.
- The bar never wraps from 768 to 2560 px.

---

### P5 — User card and account menu (1.5 days)

| ID   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P5.1 | **`useAccountItems()`**, the one source of truth. It returns an ordered, typed list: `identity`; `areaSwitch` (if `canSwitchArea`); links (Security, My access); `theme`; `language`; `layout` (density, width, reset); `help`; `signOut`. Both renderers below map over it, so desktop and phone can't drift (U1).                                                                                                                                                                                                                                                                                                                                                           |
| P5.2 | **Add submenu support to `dropdown-menu.tsx`:** export `DropdownMenuSub`, `DropdownMenuSubTrigger` and `DropdownMenuSubContent`, styled like the existing rows. This is a shared UI file, so coordinate it with any parallel session.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| P5.3 | **`AccountMenu`** (≥ md). A `DropdownMenu` whose trigger is **`SidebarUserCard`**: avatar, name, primary role (`roles.*`) and a `ChevronsUpDown` icon. The accessible name is `t("nav.accountFor", { name })` → "Account, Niyongabo Emmanuel"; it contains the visible name (WCAG 2.5.3) and still matches the e2e helper `getByRole("button", { name: "Account" })`. Collapsed, the card shows only the avatar, with a tooltip. Content opens `side="top"` when expanded and `side="right"` when collapsed. Theme, language and layout are **submenus with `DropdownMenuRadioItem`s**, which is the correct menu semantics; `Segmented` doesn't belong inside `role="menu"`. |
| P5.4 | **`AccountSheet`** (< md). The top-bar avatar opens a bottom `Sheet` that renders the same items as plain links and buttons, with `Segmented` controls for theme, language and density (no menu role, so segmented is fine here).                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P5.5 | **Slim the More sheet:** remove the identity, theme, language and sign-out blocks from `more-sheet.tsx`. It keeps the nav tiles, plus the area switch at the top for staff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P5.6 | **Layout preferences wired:** density and width radio items call `writeShellPrefs()` and update `data-density` / `data-width` on the shell root through the provider. No reload is needed, and the change applies on first paint next time. "Reset layout" calls `reset()` plus the defaults.                                                                                                                                                                                                                                                                                                                                                                                 |
| P5.7 | **Public header:** `UserMenu` becomes a thin wrapper rendering `AccountMenu` content with a header-style trigger (avatar + name), so the public pages and the app shell share one menu. Remove "Dashboard" from the items, and add a "Go to portal" item on public pages only.                                                                                                                                                                                                                                                                                                                                                                                                |
| P5.8 | **Avatar palette (U4):** add 8 token pairs `--avatar-1-bg/fg … --avatar-8-bg/fg` (light and dark) with chroma ≤ 0.08 and hues spaced around the brand. Change `Avatar` to pick `hash % 8`. Extend `tokens.test.ts` to check that each pair is ≥ 4.5:1.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P5.9 | **Tests:**<ul><li>The existing `auth.spec.ts` sign-out runs unchanged on desktop.</li><li>A new mobile spec covers avatar → sheet → sign out.</li><li>A unit test asserts that `AccountMenu` and `AccountSheet` render the same item ids for the same user.</li><li>axe runs with the menu open, including the submenus.</li></ul>                                                                                                                                                                                                                                                                                                                                            |

**Done when:**

- Identity lives in exactly one component tree per viewport.
- Sign-out e2e passes in both projects.
- There are no avatar contrast failures.

---

### P6 — Adaptive layout and preferences (1 day)

| ID   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P6.1 | **Container-query migration.** In `(portal)/**`, `(backoffice)/**` and the `components/data                                                                                                                                                                                                                                                                                                                                          | dashboard | backoffice | wizard`parts rendered inside`main`, replace **viewport** `md:`/`lg:`/`xl:`grid and flex-direction breakpoints with **container** breakpoints on`@container/main`. Leave `sm:` as it is (phones have no sidebar, so viewport and container agree). There are about 28 files. Use the mapping table below. Do one mechanical commit per directory. |
| P6.2 | **Visual check** per converted page at 1024 px (sidebar collapsed and expanded) and 1440 px. Toggling the sidebar must reflow without a reload.                                                                                                                                                                                                                                                                                      |
| P6.3 | **Density (`[data-density=compact]`, under `@media (pointer: fine)` only):**<ul><li>main `gap` 2rem → 1.25rem</li><li>card padding `p-6` → `p-4` (via a `--card-pad` var used by `Card` and the `rounded-3xl … p-5 sm:p-6` sections, which are converted to the `Card` primitive where they aren't already)</li><li>table `td`/`th` block padding to a 36 px row</li><li>sidebar item 40 → 34 px</li></ul>Touch keeps 44 px targets. |
| P6.4 | **Width preference:** this is already wired by the P2 CSS (`[data-width=full] main`). Verify it on the dashboard and queue.                                                                                                                                                                                                                                                                                                          |
| P6.5 | **Medium-tier polish:** the rail at 768–1023 shows icons only (no 11 px labels), with tooltips. Long fr/rw labels show in full in the tooltip and the modal sheet.                                                                                                                                                                                                                                                                   |
| P6.6 | **`useIsDesktop`:** keep it. Add `useSidebarResolved()` in the provider for the few JS consumers (trigger label, tooltip enablement) so nobody re-derives the breakpoints.                                                                                                                                                                                                                                                           |

| Old (viewport) | New (container `/main`) | Why                                                                 |
| -------------- | ----------------------- | ------------------------------------------------------------------- |
| `md:` (48rem)  | `@2xl/main:` (42rem)    | At 768 px the panel is about 680 px wide after the rail and padding |
| `lg:` (64rem)  | `@3xl/main:` (48rem)    | At 1024 px, collapsed, about 900 px; expanded, about 720 px         |
| `xl:` (80rem)  | `@5xl/main:` (64rem)    | Wide data rows only when the panel really is wide                   |

**Done when:**

- No `lg:`/`xl:` grid breakpoints remain under the two route groups. The command that checks this is in the PR description.
- Compact density visibly tightens a queue table on desktop Chrome, and not in the Pixel 7 project.

---

### P7 — Hardening, tests and docs (1 day)

| ID   | Task                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P7.1 | **`e2e/shell.spec.ts`**, a viewport matrix of 320, 375, 768, 1024, 1280, 1440, 1920 and 2560 × applicant, reviewer and admin. Assert: no horizontal scroll (`scrollWidth ≤ innerWidth`); the active nav item is visible; the sidebar footer is in the viewport (≥ md); the top bar is one line; the badge text is in the accessible name.                                                                          |
| P7.2 | **Keyboard:**<ul><li>Tab order is skip link → sidebar → top bar → main.</li><li>⌘B toggles and updates `aria-expanded`.</li><li>At 900 px the trigger opens the sheet, Esc closes it, and focus returns to the trigger.</li><li>The skip link lands focus on `#main`.</li></ul>                                                                                                                                    |
| P7.3 | **2.4.11:** extend the existing long-form test so that, with the top bar (and the bottom bar on mobile) present, every focused field's rect lies within `[header-h, innerHeight − bottom-nav-h]`.                                                                                                                                                                                                                  |
| P7.4 | **Visual regression:** `toHaveScreenshot` on `/dev/shell` (deterministic data) across expanded and collapsed, light and dark, and comfortable and compact. Use masked-content shots of the dashboard and queue.                                                                                                                                                                                                    |
| P7.5 | **Locales:** run `shell.spec.ts` once with `fr` and once with `rw`, asserting that no nav, breadcrumb or menu element has `scrollWidth > clientWidth` unless it carries a `title` or tooltip.                                                                                                                                                                                                                      |
| P7.6 | **Performance:**<ul><li>The layout adds no client JS beyond the provider (budget: +6 kB gzipped on the shell chunk; check `next build` output).</li><li>CLS is 0 on reload in every sidebar mode.</li><li>Badge queries add < 15 ms p95 to layout render (check the dev server timing log).</li></ul>                                                                                                              |
| P7.7 | **Docs:**<ul><li>Add a CLAUDE.md convention line: _"Shell: style collapsed state with `sb-collapsed:`; page grids use `@container/main` breakpoints; wide pages render `<PageWidth wide />`; set breadcrumb tails with `<BreadcrumbTail>`."_</li><li>Mark UI_MODERNIZATION_PLAN §6.1 as superseded by ADR-011.</li><li>Tick the design plan's acceptance boxes.</li><li>Delete `shell-baseline.spec.ts`.</li></ul> |

**Done when:** the whole suite is green on CI in both projects, the before/after screenshots are in the PR, and
ADR-011 moves from Proposed to Accepted after design review.

---

## 5. Definition of done (whole programme)

- [ ] Each of the findings A1–A6, N1–N7, T1–T4 and U1–U4 is either fixed, or explicitly deferred in ADR-011 with a reason.
- [ ] The sidebar collapses on desktop, remembers the choice, and shows no flash on reload.
- [ ] One nav DOM, one account menu definition, one logo.
- [ ] The back office is grouped and Queue and Decisions show live counts.
- [ ] No horizontal scroll from 320 to 2560 px. Cards reflow when the sidebar toggles.
- [ ] WCAG 2.2 AA: 2.4.11, 2.5.3, 2.5.8 and 3.2.6 are verified by tests. axe is clean in both themes.
- [ ] en is complete; rw and fr drafts are present; no overflow in fr or rw.
- [ ] No new dependencies. The shell JS budget is met.

## 6. Rollback

Each phase is one PR, so a revert is one `git revert`. P2 is the only phase that changes every page's frame. If a
pilot-blocking issue appears after it merges, revert P2 alone: P1's primitive stays unused, and P3–P6 depend on P2 so
they won't have merged yet. The `rebp_shell` cookie is harmless if left behind, because the old shell ignores it.

---

## 7. Implementation record (2026-10-16)

All eight phases are implemented in the working tree. Verified:

- `tsc` is clean, and so is `eslint src e2e`.
- Vitest: web 294/294, contracts 378/378.
- `next build` succeeds.
- Playwright passes for `shell`, `mobile`, `auth`, `consoles`, `access`, `header`, `experience`, `ui` and `gaps-v2` (the last four on a production build).
- `licensing.spec.ts` test 3 fails on production builds only. During streaming, React briefly keeps a hidden copy of the page in an `S:` segment (about 250 ms), and the strict `getByTestId("decision-APPROVED")` matches both copies. The fix is to match only the visible radio. Users never see the hidden copy. The spec belongs to the wizard workstream, which has the fix.

Where the build departs from the plan, and why:

| Plan                                                           | As built                                                                                         | Why                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| One PR per phase                                               | One working-tree change set                                                                      | The branch already carried a large uncommitted diff shared with parallel sessions.                                       |
| P2 keeps today's IA; P3 changes it                             | `navigation.ts` was rewritten once, covering both phases                                         | It is a hot file, so touching it once means one merge.                                                                   |
| The banner sits inside the panel, above the top bar            | The banner is the first child of `main`                                                          | Above the bar it pushed the bar off the logo row's baseline (A3 again). Inside `main` it also follows the content width. |
| A scroll-driven hairline on the top bar (`animation-timeline`) | `TopBar` uses a passive scroll listener                                                          | Scroll-driven animations report as permanently "running", so the e2e `settle()` helpers never resolved.                  |
| A breadcrumb `…` menu on overflow                              | The area root crumb hides below `xl` when there are three crumbs                                 | That's enough at current trail depths, and simpler.                                                                      |
| `HelpButton` opening a help sheet                              | `HelpMenu`: guidance links and keyboard shortcuts                                                | There is no help page or sheet yet.                                                                                      |
| Grouped tiles in the phone More sheet                          | One 3-column grid in sidebar order                                                               | Back-office groups hold one or two items each, so group headings wasted most of the sheet.                               |
| `<BreadcrumbTail>` on every detail page                        | Applied everywhere except the wizard page (it still shows "Applications")                        | The wizard was being reworked in a parallel session.                                                                     |
| —                                                              | `NEXT_DIST_DIR` override in `next.config.ts`; `.next-*/` ignored                                 | Lets a second local server run when `.next/dev/lock` is held, e.g. by a root-run dev server.                             |
| —                                                              | Focus returns to ◧ when the tablet sheet closes                                                  | Radix only restores focus to its own `Dialog.Trigger`, and this sheet opens programmatically.                            |
| —                                                              | `ThemeToggle` removed; the `nav.section{Applicant,Account,Staff}` message keys are left in place | Nothing uses `ThemeToggle` any more. The keys are harmless, and other locales' tooling may still list them.              |

Follow-up checks (later the same day):

- **Locales (P7.5).** French and Kinyarwanda were measured at 1024 and 1440 px.
  - Kinyarwanda breadcrumbs were cut off at 1024 px, so below `xl` the area-root crumb now folds away (the sidebar's area switcher already names it), and every crumb carries a `title`. The search takes its full width only from `xl`.
  - The French "Aller au Portail du demandeur" row was clipped, so the account menu is now 20rem wide.
  - After these fixes no shell label is clipped in either language, and `shell.spec.ts` asserts it.
- **Keyboard and focus (P7.2, P7.3).** `shell.spec.ts` now checks the tab order (skip link, sidebar, top bar, page) and that a focused control is never fully hidden under the sticky top bar (WCAG 2.4.11).
- **Lint.** `eslint.config.mjs` and `.prettierignore` now ignore `.next-*`, so alternate build folders aren't linted.
- **Deferred.**
  - P7.4: committed screenshot baselines would churn across machines. `shell.spec.ts` checks the layout geometry instead.
  - P7.6: measured in absolute terms (see below); there is no before/after budget check.

Enhancement pass (scan of every tier, both themes, open menus):

- **Account menu.** Link rows used 36 px icon tiles while the theme, language and layout rows used bare icons, so the icon column jumped. The menu now uses flat rows throughout: one icon column, denser, with "Reset layout" and "Sign out" in the same style.
- **Applicant badge (FR-PORTAL-001).** "Applications" now shows how many of the applicant's applications need them: an information request (`ACTION_REQUIRED`) or a payment (`PENDING_PAYMENT`). This matches the dashboard's required actions.
- **"More" on phones.** When a destination behind "More" has a count, the tab shows a dot and its name reads "More, 1 waiting".
- **Badge names.** A visually hidden suffix in a separate (absolutely positioned) span made Chrome compute "Confirmations , 1 to confirm". Links with a count now carry an `aria-label` that starts with the visible label ("Confirmations, 1 to confirm"), so WCAG 2.5.3 still holds.

2026 parity pass (see the design plan §4.4 and ADR-011 amendment v2):

- **Resizable sidebar:** a drag/keyboard window splitter, with the width saved in `rebp_shell` (`sidebarWidth`).
- **Floating phone tab bar:** a pill, with `--bottom-nav-h` following its footprint.
- **⌘K palette:** a "Recent" group before typing (per account, cleared on sign-out) and letters-in-order matching.
- **Verified:** `shell.spec.ts` gained two tests (11 in total); shell, mobile, auth and experience pass 44/44; lint is clean; contracts 379/379.

Review round 3 (visual scan plus an independent code review):

- **Visual.**
  - Forced-colours (Windows high contrast): a `Highlight` outline marks the current page, and badge dots use `CanvasText`.
  - Rail separators are short 24 px centred lines.
  - Print hides the sidebar, top bar, tab bar and banner, and the panel prints flush.
- **Code review, nine findings, all fixed.**
  - Label tooltips stuck open after collapsing. With no content to hover, Radix's grace area never closed them. The fix is `disableHoverableContent`, with content rendered only on the rail.
  - The tablet sheet reopened on Back. A stale `sheetPath` is now cleared during render, and links inside the sheet close it.
  - The palette kept a stale query and index. Each opening is a keyed session and the index is clamped. Result groups now have names.
  - A cancelled drag left the previewed width on screen.
  - Double-click to reset collapsed the sidebar first. A single click now toggles after a 250 ms beat that a double-click cancels.
  - Recents could record the previous page's title. They now wait for the title to change, via a `MutationObserver`.
  - Breadcrumb tails are scoped to their path.
  - "Reset layout" now resets the width.
  - ⌘B no longer swallows the browser shortcut on phones.
  - Group ids come from `useId()`.
- **Regression found by the parallel run.** Focus return on the tablet sheet still targeted the old `aria-controls`. It now uses `[data-sidebar-trigger]`.
- **Verified.** `shell.spec.ts` has 13 tests, two of them new regression tests. Shell, mobile, auth and experience pass 46/46; tsc and lint are clean. The parallel full suite passes 100/100 on a production build.

Responsiveness audit (24 devices × 2 roles × 4 pages):

- **Devices:** a 280 px foldable, the 320 px SE, phones up to 430 px, landscape phones (667×375, 844×390, 932×430), iPad mini/Air/Pro in both orientations, laptops from 1280×720 to 1536×864, FHD, QHD, 3440 ultrawide, and 200%/400% zoom.
- **Checks:** page overflow, unclipped spill, top-bar wrap, hidden sidebar footer, targets under 24 px, and bottom-bar footprint.
- **Result:** 192/192 clean on dev data after the fixes. Real seeded data (on `rebp_test`) exposed two content-dependent overflows, which are fixed below.
- **Fixes:**
  - Short screens (`max-height: 40rem`): the top bar drops to 52 px and the tab bar to 48 px, icons only. `--header-h` and `--bottom-nav-h` follow, scoped to the shell.
  - Tab labels become `sr-only` below 336 px.
  - The dashboard stepper labels wrap within their columns.
  - Breadcrumb links are at least 24 px tall, and the resize handle has a 24 px hit area.
  - Report grids use `grid-cols-1` / `min-w-0` / `flex-wrap`.
  - `StatTile` labels may shrink and break, and its value row wraps.
- **Regression test:** `shell.spec.ts` covers the foldable, a landscape phone, 200% zoom and 400% zoom (15 tests). Shell, mobile, access and auth pass 31/31 on a production build.
- **Tooling note:** a custom `NEXT_DIST_DIR` makes Next add that folder's generated types to `tsconfig.json`, and in `next dev` the regenerated `routes.d.ts` then retriggers HMR in a reload loop. Use production builds for second servers. My `.next-d9*` entries have been removed from `tsconfig.json`, which now matches git.

JavaScript cost (P7.6), measured on a production build:

- **Area layout chunk:** each area layout's client chunk (portal or back office) is 13.9 kB / 12.9 kB gzipped. It holds the whole shell: sidebar primitive, account menu, palette trigger, bottom bar, notifications and language menu.
- **Shared chunk:** 5.8 kB gzipped, holding the area switcher, More sheet, help menu and breadcrumbs.
- **Lazy palette:** the command-palette dialog still loads on first use.
- **No before/after delta:** the working tree carries several workstreams' uncommitted changes, so the pre-shell layout can't be rebuilt in isolation. CLS on reload is 0 in every sidebar mode.

Open items:

- ADR-011 status moves to Accepted after design review.
