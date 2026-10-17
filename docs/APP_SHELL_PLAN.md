# App Shell Plan — layout, navigation and account chrome

| Item        | Value                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Document ID | REBP-PORTAL-UX-003                                                                                                          |
| Version     | 1.0 (draft for design and tech-lead review)                                                                                 |
| Date        | 2026-10-16                                                                                                                  |
| Baseline    | [UI Modernisation Plan](UI_MODERNIZATION_PLAN.md) §6 (P2 shell) · [ADR-009 visual language](adr/ADR-009-visual-language.md) |
| Refs        | UX-001, UX-003, FR-PORTAL-001, FR-RPT-001, NFR-USE, WCAG 2.2 AA (2.4.11, 2.5.8, 1.4.10, 3.2.6)                              |
| Audience    | Front-end engineers and designers working on the authenticated shell (portal and back office)                               |
| Status      | Implemented 2026-10-16 (P0–P7, see the delivery plan); ADR-011 awaiting design review                                       |
| Delivery    | [APP_SHELL_IMPLEMENTATION.md](APP_SHELL_IMPLEMENTATION.md) (phases P0–P7, PR-sized)                                         |

---

## 1. Summary

The portal and the back office share one shell, [app-shell.tsx](../apps/web/src/components/layout/app-shell.tsx). It works,
but it reads as three loosely related layers rather than one layout:

- the sidebar
- a frosted header strip
- a patterned content area

The account controls are spread over the header, the dropdown and the phone "More" sheet. The sidebar cannot be collapsed
on desktop, although the P2 plan called for it. The content width is fixed at `max-w-6xl` on every page, so back-office
tables get the same width as the dashboard.

This plan rebuilds the shell as a **flat, inset layout**: a quiet, full-height sidebar, and the page as a single rounded
panel beside it. It adds:

- a collapsible sidebar with remembered state
- a user card in the sidebar footer
- an area switcher (Portal ↔ Back office)
- grouped back-office navigation with live counts
- a calmer top bar with breadcrumbs
- three viewer preferences: sidebar mode, density and content width

Nothing changes in routing, guards or capability filtering.

| Phase  | Theme                      | Outcome                                                                        | Effort   |
| ------ | -------------------------- | ------------------------------------------------------------------------------ | -------- |
| **S0** | Decisions and tokens       | ADR-011, layout tokens, preference schema in `@rebp/contracts`                 | 0.5 day  |
| **S1** | Sidebar primitive          | `components/ui/sidebar.tsx`: provider, collapse, cookie, ⌘B, tooltips, badges  | 2 days   |
| **S2** | Shell structure            | Grid shell, inset content panel, aligned rows, banner fix, calm canvas         | 1.5 days |
| **S3** | Navigation IA              | Grouped back office, area switcher, account links out of the main nav, badges  | 1 day    |
| **S4** | Top bar                    | Toggle, breadcrumbs, wider search, slimmer right cluster, scroll-driven border | 1 day    |
| **S5** | User card and account menu | Sidebar-footer identity card, one account menu for every viewport              | 1 day    |
| **S6** | Responsive tiers and prefs | Auto/expanded/collapsed by viewport, density, content width, container queries | 1 day    |
| **S7** | Verification               | Viewport matrix, axe, keyboard, 2.4.11, long-label (fr/rw) and visual tests    | 1 day    |

Total: about **9 dev-days**. Each phase ships on its own behind no flag. S1 → S2 are sequential. S3–S5 can run in
parallel once S2 lands.

---

## 2. Review of the current shell

Reviewed on the applicant dashboard at 1512 px (screenshot, 2026-10-16) and in the source: `app-shell.tsx`, `app-nav.tsx`,
`nav-link.tsx`, `bottom-nav.tsx`, `more-sheet.tsx`, `user-menu.tsx`, `config/navigation.ts`.

### 2.1 Overall structure

| #   | Finding                                                                                                                                                                                                                                                                                         | Severity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1  | **Three surface tones compete**: `bg-sidebar`, the frosted `bg-card/70` header, and the content area with `bg-ambient` plus the Imigongo pattern. None of them reads as "the page", so the eye has no resting plane.                                                                            | High     |
| A2  | **The sidebar's sticky height is wrong under the banner.** The `<aside>` is `sticky top-0 h-dvh` but sits below `<PilotBanner>`, so at scroll 0 its bottom 36 px is off-screen. A footer (user card, help) would be cut off. The bug is invisible today only because the sidebar has no footer. | High     |
| A3  | **Sidebar logo row and header row don't share a baseline.** The logo sits in a `p-4` block; the header is `h-16`. They miss by about 5 px and have no shared divider, so the top-left corner looks unaligned.                                                                                   | Medium   |
| A4  | **Content width is one size for all.** `main` is `max-w-6xl` (72 rem) on every page. At 1024 px with a 272 px sidebar, back-office tables get about 690 px. At 1920 px, the dashboard floats in 300 px gutters on each side.                                                                    | Medium   |
| A5  | **The nav is rendered twice.** `AppShell` renders `<AppNav>` for the sidebar and again for the rail, and also renders `<Logo>` twice, toggling with `hidden`/`lg:hidden`. It's harmless for assistive tech (`display:none`), but it is duplicated DOM and two code paths to keep in sync.       | Low      |
| A6  | **Decoration on working screens.** The ambient glow and Imigongo pattern suit the landing page. On a work screen they add noise behind data, and they show through the tinted "Licence wallet" card.                                                                                            | Low      |

### 2.2 Left navigation

| #   | Finding                                                                                                                                                                                                                                                       | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| N1  | **No collapse on desktop.** P2 §6.1 specified a sidebar "collapsible to the rail, with the state remembered". It was never built. People with 1024–1366 px laptops can't reclaim 272 px.                                                                      | High     |
| N2  | **The back office is one flat list of up to nine items** under "Staff": Overview, Queue, Decisions, Register, Finance, Configuration, Reports, Access, Audit. It has no grouping, so work items sit next to admin items.                                      | High     |
| N3  | **No counts.** `consoleCounts()` already computes what is waiting in Queue and Decisions, but only the overview tiles show it. The nav, which is visible on every page, does not.                                                                             | Medium   |
| N4  | **The active state is encoded three times**: a tinted pill, a 4 px primary bar, and a coloured icon. The bar sits at the sidebar's inner edge, _outside_ the pill's rounded corner, so it looks detached (visible in the screenshot).                         | Medium   |
| N5  | **Portal ↔ back-office switching is done with nav entries.** A "Staff → Back office" section is appended to the portal nav, and "Applicant → Portal" to the back office. That is a context switch, not a destination, and it costs a section header each way. | Medium   |
| N6  | **Account destinations take primary nav space.** "Security" and "My access" are settings. They belong with the person (the user menu), not alongside work areas.                                                                                              | Low      |
| N7  | **Section labels shout.** 0.7 rem bold uppercase with wide tracking. Modern flat shells (Linear, Vercel, shadcn) use sentence-case, muted 12 px labels.                                                                                                       | Low      |

### 2.3 Top bar

| #   | Finding                                                                                                                                                                                      | Severity |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| T1  | **No sense of place.** The bar holds search and tools only; there is no page title or breadcrumb. Deep back-office pages (`/backoffice/review/[id]`) give no way back up except the sidebar. | Medium   |
| T2  | **The search trigger is small and pushed left** (`min-w-56`). The bar's middle is empty, while the right cluster holds four controls plus the name.                                          | Low      |
| T3  | **Theme sits in prime header space.** It's a set-once preference. Language stays: this is a trilingual public service, and switching language is a frequent, high-value action.              | Low      |
| T4  | **The frosted bar uses a JS scroll listener** (`HeaderShell` on public pages). The app header has a permanent blur. CSS scroll-driven animation can add the hairline on scroll with no JS.   | Low      |

### 2.4 User card

| #   | Finding                                                                                                                                                                                                                                                                        | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| U1  | **Identity is split across three places.** On desktop it's an avatar plus full name in the header, and a dropdown with Dashboard, Security and Sign out. On phones it's the header avatar again, plus a second identity block in the More sheet. They have different contents. | Medium   |
| U2  | **The trigger doesn't look clickable.** There is no chevron or role line. "Niyongabo Emmanuel" reads as a label.                                                                                                                                                               | Low      |
| U3  | **The menu omits things people look for there**: My access, theme, language (on phones it has them, on desktop it doesn't), help, and area switching. "Dashboard" is redundant with the nav.                                                                                   | Low      |
| U4  | **The avatar hue comes from a character-code sum**, so it can land on any hue. Pink "NE" next to a royal-blue brand looks accidental. Keep the per-person colour, but limit chroma and hue to a curated set of eight token pairs.                                              | Low      |

### 2.5 Responsiveness

| Viewport        | Today                                          | Problem                                                                                                                        |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| < 768           | Top bar + bottom tab bar (3 tabs + More)       | Good. Keep it. The More sheet duplicates identity (U1).                                                                        |
| 768–1023        | 88 px rail, icon + 11 px label below           | 0.68 rem labels are under the 12 px floor. French and Kinyarwanda labels wrap or clamp. There is no way to expand temporarily. |
| 1024–1279       | Full 272 px sidebar, fixed                     | Content shrinks to about 690 px. Tables and the review split screen are cramped. You can't collapse it (N1).                   |
| ≥ 1280          | Full sidebar, content capped at 72 rem         | Fine on dashboards. Wasted width for queues and the audit log (A4).                                                            |
| Cards and grids | Respond to the **viewport** (`lg:grid-cols-…`) | Once the sidebar collapses, the available width changes but viewport breakpoints don't. Cards need **container queries**.      |

### 2.6 What already works (keep)

- Capability-filtered nav from one config (`navForArea`), with client components importing it themselves (CLAUDE.md rule).
- The phone bottom bar in the thumb zone, the M3-style active pill, safe-area padding and the `--bottom-nav-h` token.
- View-transition pinning (`app-sidebar`, `app-header`, `app-bottom-nav`).
- The command palette, lazy-loaded behind ⌘K.
- The skip link to `#main`, `aria-current`, and 44 px targets.

---

## 3. Research: what modern flat shells do

| Source                                                                                                                                                                                                                          | Takeaway we adopt                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar)                                                                                                                                                              | One composable primitive: `SidebarProvider` holds state, persists it in a **cookie** read on the server (no flash), toggles with **⌘B**, offers `collapsible="icon"` and an `inset` variant where the page is a rounded panel. Our UI is already shadcn-style, so we adapt this structure rather than inventing one. |
| [Linear — design refresh](https://linear.app/now/behind-the-latest-design-refresh)                                                                                                                                              | "Parts central to the user's task should stay in focus; ones that support orientation and navigation should recede." The sidebar is dimmed a few notches below the content, and borders and separators are softened.                                                                                                 |
| [Material 3 nav rail](https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-rail/usage), [Android adaptive nav](https://developer.android.com/jetpack/compose/nav-adaptive) | Size classes: compact uses a bottom bar, medium uses a rail, expanded uses a rail or a persistent drawer. M3 Expressive replaces the drawer with an **expanded rail**: one component with collapsed and expanded states, plus a **modal** expanded form for medium widths.                                           |
| [NN/g — hidden navigation](https://www.nngroup.com/articles/find-navigation-desktop-not-hamburger/)                                                                                                                             | Hiding navigation on desktop cuts discoverability (about 20% in their study), and the effect is larger on desktop than on mobile. So **expanded is the default on wide screens**, collapse is the user's choice, and collapsed keeps icons visible rather than going off-canvas.                                     |
| [SaaS sidebar patterns](https://www.saasui.design/blog/saas-sidebar-navigation-ux-patterns), [SGDS sidebar](https://designsystem.tech.gov.sg/components/sidebar)                                                                | Group destinations. Put primary destinations before settings. Give collapsed mode tooltips. Leave long-tail items to search or the command palette. Sidebars suit admin tools where people switch areas often.                                                                                                       |
| [Sidebar user footer pattern](https://www.shadcnblocks.com/block/sidebar6)                                                                                                                                                      | The **user menu goes in the sidebar footer** and the **workspace or area switcher goes in the sidebar header**. This is the common split in current admin shells.                                                                                                                                                    |
| [GOV.UK One Login header](https://github.com/govuk-one-login/service-header)                                                                                                                                                    | Separate the _account_ space from the _service_ navigation so people can see they are two things. For us: the area switcher and nav are service space; the footer card is account space.                                                                                                                             |
| [WCAG 2.4.11 Focus Not Obscured](https://allaccessible.org/blog/wcag-2411-focus-not-obscured-minimum-implementation-guide)                                                                                                      | A sticky header or bottom bar must not hide the focused element. Use `scroll-padding-top` and `scroll-padding-bottom` equal to the bars' heights.                                                                                                                                                                    |
| CSS container queries (Baseline since 2023; Tailwind v4 `@container`)                                                                                                                                                           | Components respond to the width their parent gives them, so collapsing the sidebar reflows cards correctly.                                                                                                                                                                                                          |

---

## 4. Target design

### 4.1 Layout (≥ 1280 px, expanded)

```
┌──────────────────┬────────────────────────────────────────────────────────────────┐
│ ▣ REBP Portal    │ ┌────────────────────────────────────────────────────────────┐ │
│ ┌──────────────┐ │ │ ◧  Back office › Queue        [ Search or jump to…  ⌘K ]  🌐 🔔 ? │
│ │ Applicant  ⇅ │ │ ├────────────────────────────────────────────────────────────┤ │
│ └──────────────┘ │ │                                                            │ │
│                  │ │  Page title                                    [Action]    │ │
│ ⊞ Dashboard      │ │                                                            │ │
│ ▤ Applications 2 │ │  content (container-query aware, width per page)           │ │
│ ▭ Licence wallet │ │                                                            │ │
│ ✉ Confirmations  │ │                                                            │ │
│                  │ │                                                            │ │
│                  │ │                                                            │ │
│ ─────────────    │ │                                                            │ │
│ ? Help           │ │                                                            │ │
│ ┌──────────────┐ │ │                                                            │ │
│ │(NE) Niyongabo│ │ │                                                            │ │
│ │  Applicant  ⌃│ │ │                                                            │ │
│ └──────────────┘ │ └────────────────────────────────────────────────────────────┘ │
└──────────────────┴────────────────────────────────────────────────────────────────┘
  sidebar 16rem,        inset panel: m-2 rounded-2xl bg-background, hairline border
  bg-sidebar (dimmer)   header lives inside the panel; the page scrolls (document)
```

Collapsed (`collapsible="icon"`), 4.5 rem:

```
┌────┬─────────────────────────────┐
│ ▣  │ ◧  Queue        [🔍]  🌐 🔔 │
│ ⇅  │                             │
│ ⊞  │                             │   hover/focus → tooltip with label (+ count)
│ ▤• │                             │   badge becomes a dot
│ ▭  │                             │
│ …  │                             │
│ ?  │                             │
│(NE)│                             │   avatar opens the same account menu (side="right")
└────┴─────────────────────────────┘
```

### 4.2 Responsive tiers

| Tier         | Width     | Navigation                                                                                                                                                                 | Top bar                                           |
| ------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Compact**  | < 768     | Bottom tab bar (3 + More), unchanged. The More sheet becomes nav only; the account content moves to the shared account menu, opened from the header avatar.                | Logo · search icon · bell · avatar                |
| **Medium**   | 768–1023  | Collapsed rail (icons, tooltips, dot badges). ◧ opens the **modal expanded sidebar** as a left sheet (M3 modal expanded rail). No persistent expanded state at this width. | ◧ · title · search · bell                         |
| **Expanded** | 1024–1279 | Sidebar in **auto** mode defaults to **collapsed**. The user can pin it expanded (cookie).                                                                                 | ◧ · breadcrumbs · search · language · bell · help |
| **Large**    | ≥ 1280    | Auto mode defaults to **expanded**. The user can pin it collapsed (cookie).                                                                                                | Same                                              |

"Auto" means the viewport decides. The first explicit toggle at ≥ 1024 stores `expanded` or `collapsed` and wins from
then on. "Reset layout" in the account menu returns to auto.

### 4.3 Visual rules (flat, per ADR-009 v3)

- **Planes.** There are two: the sidebar plane (`--sidebar`, about 2 L-steps below `--background` in light mode, and the
  reverse in dark mode) and the content panel (`--background`). The panel is separated by tone plus a 1 px alpha hairline.
  It has no shadow. The authenticated shell drops `bg-ambient` and the Imigongo fade; brand cards keep their own pattern.
- **Nav item**: 40 px tall on fine pointers and 44 px on coarse pointers (`pointer: coarse`). It has a 20 px icon, 14 px
  label and a 10 px radius. **Active** gets the `bg-sidebar-accent` pill, a `font-semibold` label and a `text-link` icon.
  **Remove the side bar indicator** (N4). Hover uses a 4% foreground tint.
- **Section labels**: sentence case, 12 px, `font-medium`, `text-muted-foreground`, 8 px above the group.
- **Badges**: a pill with tabular numerals (`num`) on the trailing edge; the critical tone only for SLA breaches. Collapsed,
  the badge is a 6 px dot on the icon. Its accessible name comes from the link: "Queue, 4 waiting".
- **Rows align.** The sidebar header (logo) and the top bar share `--header-h: 3.5rem` and sit on the same baseline.
- **Motion.** Width animates via `grid-template-columns` over `--dur-3` with `--ease-standard`. Labels fade at `--dur-1`
  before the collapse and after the expand, so text never squashes. Under reduced motion the change is instant.

---

### 4.4 Comparison with 2026 shells (review of 2026-10-16)

| 2026 pattern                                                                                                                                                                   | Before the review               | Outcome                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| Collapsible left sidebar, back in favour over top tabs ([saasframe](https://www.saasframe.io/blog/the-anatomy-of-high-performance-saas-dashboard-design-2026-trends-patterns)) | Done                            | Kept                                                                         |
| Calm, dimmed navigation; fewer icons; softer separators (Linear, March 2026)                                                                                                   | Done (sidebar one step dimmer)  | Kept                                                                         |
| **Resizable** sidebar that can also hide ([Vercel, 26 Feb 2026](https://vercel.com/changelog/dashboard-navigation-redesign-rollout))                                           | Collapse only                   | **Added**: drag/keyboard splitter, width remembered                          |
| **Floating bottom bar** for one-handed mobile use (Vercel 2026)                                                                                                                | Docked full-width bar           | **Added**: floating pill                                                     |
| ⌘K palette with **recent items by default** and typo-tolerant search ([saasui](https://saasui.design/blog/7-saas-ui-design-trends-2026))                                       | Pages and preferences only      | **Added**: Recent group, letters-in-order matching                           |
| Role-based, progressively disclosed navigation                                                                                                                                 | Capability-filtered, grouped    | Kept                                                                         |
| One primary next action per screen                                                                                                                                             | Page-level, not the shell's job | Out of scope (pages)                                                         |
| Translucent "glass" chrome (Apple Liquid Glass, 2025)                                                                                                                          | Flat                            | **Rejected**: contrast failures ([Infinum](https://infinum.com/?p=19266836)) |
| Pinned or favourite items ([GitLab](https://docs.gitlab.com/ee/tutorials/left_sidebar/))                                                                                       | —                               | Deferred: at most nine destinations per area; recents cover the long tail    |

## 5. Phases

### S0 — Decisions and tokens (0.5 day)

1. **ADR-011 "Authenticated shell"**, amending P2 §6.1. It covers:
   - the inset layout
   - the tiers in §4.2
   - the sidebar in the document scroll (not a nested scroller), so the mobile address bar, scroll restoration and
     `scroll-padding` keep working
   - the preference cookie
   - an amendment noting that the account menu moves out of the header on ≥ md
2. **Layout tokens** in `globals.css`. Note that `--banner-h` is set by the banner itself.

   ```css
   :root {
     --sidebar-w: 16rem;
     --sidebar-w-icon: 4.5rem;
     --header-h: 3.5rem;
     --banner-h: 0px;
     --content-max-default: 72rem;
     --content-max-wide: 90rem;
   }
   ```

3. **Preference schema** in `@rebp/contracts` (`shell.ts`). It's a contract because the server reads it and the client
   writes it.

   ```ts
   export const ShellPrefs = z.object({
     sidebar: z.enum(["auto", "expanded", "collapsed"]).default("auto"),
     density: z.enum(["comfortable", "compact"]).default("comfortable"),
     width: z.enum(["default", "full"]).default("default"),
   });
   ```

   Stored in one cookie, `rebp_shell`: `SameSite=Lax`, one year, not `HttpOnly` (the client toggles it). It contains no
   PII. Parse it with `safeParse` and fall back to defaults.

**Acceptance:** the ADR is merged, the token test still passes, and the contract has a unit test (bad cookie → defaults).

### S1 — Sidebar primitive (2 days)

Create `src/components/ui/sidebar.tsx`. Its structure follows shadcn's Sidebar, written in our tokens and conventions. It
is copied-in code, so **no new package** is needed (the `minimumReleaseAge` policy is untouched).

| Part                                                                                               | Responsibility                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SidebarProvider`                                                                                  | Context: `mode` (auto/expanded/collapsed from the cookie), the resolved `state` (expanded/collapsed), `openMobile` (medium-tier sheet) and `toggle()`. Writes the cookie. Sets `data-sidebar-state` on the shell root so **CSS, not JS, drives widths**. |
| Keyboard                                                                                           | **⌘B / Ctrl+B** toggles, ignored while focus is in an input, textarea or contenteditable. Advertised via `aria-keyshortcuts` and listed in the command palette.                                                                                          |
| `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel` | Layout slots. `SidebarContent` scrolls on its own (`overflow-y-auto`, `overscroll-contain`) so the footer card stays visible.                                                                                                                            |
| `SidebarMenuButton`                                                                                | One link component for both states. When collapsed it hides the label (`sr-only`, keeping the accessible name) and wraps itself in our `Tooltip` (`side="right"`, 300 ms delay, label + count).                                                          |
| `SidebarMenuBadge`                                                                                 | Count pill / dot. Its count is folded into the link's accessible name.                                                                                                                                                                                   |
| `SidebarTrigger`                                                                                   | The ◧ button. `aria-expanded`, `aria-controls="app-sidebar"`, and the label "Collapse sidebar" or "Expand sidebar".                                                                                                                                      |
| `SidebarRail`                                                                                      | A 6 px invisible hit strip on the sidebar's edge. Click toggles; the cursor shows `ew-resize`. It's for pointer users only and is hidden from AT (the trigger is the accessible control).                                                                |

**SSR without a flash.** `AppShell` (a server component) reads `cookies()` and passes `prefs` to the provider. The initial
`data-sidebar-state` for `auto` must work without JS, so render `data-sidebar-mode="auto"` and let CSS decide:
collapsed under `xl`, expanded at `xl` and up. JS only takes over after the first explicit toggle.

**Single render (fixes A5).** There is one `<nav aria-label="Main navigation">`. The rail and expanded looks are the same
DOM restyled by `group-data-[sidebar-state=collapsed]:…`. The logo renders once, and its wordmark hides when collapsed.

**Acceptance:** Storybook-free check via `/dev/shell` (the dev route group exists):

- toggles, the cookie and ⌘B all work
- there is no layout shift on reload in each mode (Playwright measures CLS = 0)
- tooltips appear on keyboard focus, not just hover

### S2 — Shell structure (1.5 days)

Rewrite `AppShell` as a grid:

```tsx
<div
  data-sidebar-mode={prefs.sidebar}
  data-density={prefs.density}
  className="grid min-h-dvh grid-cols-[auto_minmax(0,1fr)] bg-sidebar max-md:grid-cols-1"
>
  <Sidebar id="app-sidebar" /> {/* sticky top-0 h-dvh, full height (fixes A2) */}
  <div className="flex min-w-0 flex-col md:p-2 md:pl-0">
    <div className="@container/main flex flex-1 flex-col bg-background md:rounded-2xl md:border md:border-border/60">
      <PilotBanner /> {/* moved inside the panel, see below */}
      <TopBar /> {/* sticky top-0 inside the panel, h-(--header-h) */}
      <main id="main">{children}</main>
    </div>
  </div>
  <BottomNav /> {/* < md, unchanged */}
</div>
```

- **Banner (A2).** Move `PilotBanner` inside the content panel, above the top bar, so the sidebar always owns the full
  viewport height. On phones it stays full width. Also offer a **dev-mode chip in the top bar** (`DevModeChip` already
  exists) as an option for staff who find the full-width notice heavy. The ADR decides between the two.
- **Inset only at ≥ md.** Below md the panel has no margin, radius or border (a phone screen is already the panel).
- **Calm canvas (A1, A6).** Remove the two ambient `<div>`s from `AppShell`. Pages that want a hero wash (the dashboard
  greeting) opt in with `<PageHero>`.
- **Content width (A4).** Add `src/components/layout/page-container.tsx`:
  `<PageContainer width="default | wide | full">`, mapped to `--content-max-default`, `--content-max-wide` and `none`, with
  `px-4 sm:px-6 lg:px-8`.
  - Default: portal pages.
  - `wide`: queue, audit, access, finance and register admin.
  - The viewer's `width: "full"` preference overrides both.
  - `main` loses its hard-coded `max-w-6xl`.
- **Focus not obscured (2.4.11).** Set `html { scroll-padding-top: calc(var(--header-h) + 0.5rem);
scroll-padding-bottom: var(--bottom-nav-h, 0px); }`.
- Keep the `viewTransitionName`s on the sidebar, top bar and bottom nav.

**Acceptance:**

- The sidebar footer is fully visible at scroll 0 with the banner shown.
- The logo and top-bar baselines are equal (±1 px, asserted in Playwright via `boundingBox`).
- There is no horizontal scroll from 320 to 2560 px.

### S3 — Navigation IA (1 day)

Changes to `config/navigation.ts`, which stays the single source:

1. **Group the back office** (N2). `NavSection.label` gains `sectionWork | sectionRegistry | sectionInsights | sectionAdmin`.

   | Group    | Items                 | Rationale                           |
   | -------- | --------------------- | ----------------------------------- |
   | (none)   | Overview              | Home, no label                      |
   | Work     | Queue, Decisions      | Daily tasks, the counts live here   |
   | Registry | Register, Finance     | Records the office maintains        |
   | Insights | Reports, Audit        | Read-mostly                         |
   | Admin    | Configuration, Access | Rare and sensitive, so it goes last |

   Groups left empty after capability filtering disappear (`filterNav` already does this).

2. **Area switcher** (N5). Remove the cross-link sections appended in `navForArea`. Add `AreaSwitcher` in
   `SidebarHeader`: a compact select-style button ("Applicant portal" / "Back office"). It shows only when the user has
   `backoffice.access`. When collapsed it's an icon with a tooltip. On phones it goes at the top of the More sheet.
3. **Account items out** (N6). Remove `sectionAccount` from both nav trees. Security and My access live in the account
   menu (S5) and in the command palette. `/settings/*` pages get `LinkTabs` (Security · My access) so they stay
   reachable from each other.
4. **Badges** (N3). Add `badge?: "queue" | "decisions" | "confirmations" | "actions"` to `NavItem`.
   - `AppShell` fetches the counts on the server: `consoleCounts()` for the back office, and pending confirmations or
     required actions for the portal.
   - It passes them to the client as a **plain `Record<string, number>`**. Numbers are serialisable, which honours the
     no-functions-across-the-boundary rule.
   - Refresh the counts on navigation (they're in the layout, so use `router.refresh()` after actions that change them).
     Don't poll.
5. **Phone tabs.** The back office uses Overview · Queue · Decisions + More, and the portal stays as it is. `mobileTabs()`
   is unchanged.
6. i18n: add the new section labels, `nav.areaSwitch`, `nav.collapseSidebar`, `nav.expandSidebar` and the badge
   accessible-name patterns (`nav.badge.queue: "{count} waiting"`) to `en.json`, with draft `rw`/`fr`.

**Acceptance:** for each seeded role (run `pnpm db:seed`), a snapshot of the rendered nav tree matches the expected
groups. The RBAC test that "nav filters by effective capability" still passes.

### S4 — Top bar (1 day)

New `src/components/layout/top-bar.tsx`. Left to right:

| Slot   | ≥ md                                                                                                                                                                          | < md                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Toggle | `SidebarTrigger`                                                                                                                                                              | —                     |
| Place  | **Breadcrumbs**, derived from the nav config plus an optional page-supplied tail (application reference, person name), via a `<BreadcrumbTail>` client slot set from the page | Logo                  |
| Search | `CommandPalette`, centred, `flex-1 max-w-md`                                                                                                                                  | Icon button           |
| Tools  | Language (flag menu), notifications, help (`?` opens the help sheet; same place on every page, WCAG 3.2.6)                                                                    | Notifications, avatar |

- **Theme leaves the bar** (T3) and goes into the account menu.
- **Border on scroll** (T4): add a hairline only once content scrolls under the bar, using
  `animation-timeline: scroll()` and an `@supports` fallback (the border is always on). Drop `backdrop-blur` in the app
  shell: the bar is opaque `bg-background`, which is flatter and cheaper to paint.
- **Optional: collapsing large title.** Already specified in P2 §6.1 and still optional; not in this plan's scope.

**Acceptance:**

- Breadcrumbs are a `<nav aria-label="Breadcrumb">` with `aria-current="page"` on the last item.
- At 1024 px with the sidebar expanded, the bar never wraps. It truncates the breadcrumb middle with an ellipsis menu.

### S5 — User card and account menu (1 day)

1. **`SidebarUserCard`** in `SidebarFooter` (≥ md). It shows the avatar, full name (truncated), a primary role label
   (`roles.*`) and a `ChevronsUpDown` icon. The card is the trigger (button, `aria-label` "Account", so the e2e
   `signOut()` helper keeps working). When collapsed it shows the avatar only, with a tooltip.
2. **One `AccountMenu`** shared by the sidebar card (≥ md, opens `side="top"` when expanded and `side="right"` when
   collapsed) and the header avatar (< md, opens as a bottom sheet). Its contents, in order:
   - Identity block (name, email, roles)
   - Area switch (if staff)
   - Security, My access
   - Theme: `Segmented` Light / Dark / System
   - Language: `Segmented` EN / RW / FR (also kept in the top bar on ≥ md)
   - Layout: density (Comfortable / Compact), width (Default / Full), "Reset layout"
   - Help and support
   - Sign out (danger tone)

   Drop "Dashboard" (U3). The More sheet on phones loses its identity, theme and language block and keeps only
   navigation tiles (U1).

3. **Avatar palette** (U4): map the name hash to 8 curated `--avatar-n-bg`/`--avatar-n-fg` token pairs, light and dark,
   each ≥ 4.5:1. Add them to `tokens.test.ts`.

**Acceptance:**

- The account menu has the same items at every viewport.
- `auth.spec.ts` sign-out passes unchanged.
- axe finds no violations with the menu open.

### S6 — Responsive tiers and preferences (1 day)

- Implement the tiers in §4.2 with CSS keyed on `data-sidebar-mode` / `data-sidebar-state` and Tailwind breakpoints.
  `useMediaQuery` (already in `src/hooks`) is used only to decide what the trigger does at medium width (open the sheet
  instead of toggling).
- **Container queries.** Mark `main` as `@container/main`. Convert shell-sensitive grids from viewport breakpoints to
  container breakpoints, so that collapsing the sidebar reflows them. Examples: `lg:grid-cols-[1.2fr_1fr]` →
  `@4xl/main:grid-cols-[1.2fr_1fr]`. Targets:
  - dashboard
  - back-office overview
  - queue
  - review split screen
  - stat-tile rows
- **Density.** `[data-density=compact]` lowers the spacing tokens: card padding, table row height 44 → 36 px, gap scale.
  It applies **only under `@media (pointer: fine)`**; touch keeps 44 px (WCAG 2.5.8 is satisfied either way, at 24 px
  minimum).
- **Long labels.** French and Kinyarwanda nav labels run up to about 35% longer. The expanded sidebar truncates with
  `title` and tooltip. The rail tier no longer shows labels under icons (fixes the 11 px text), and the tooltip carries
  the label.

**Acceptance:**

- Toggling the sidebar at 1280 px reflows dashboard cards without a reload.
- Compact density changes row height on desktop Chrome and not in the Pixel 7 profile.

### S7 — Verification (1 day)

- **Viewport matrix** (Playwright projects): 320, 375, 768, 1024, 1280, 1440, 1920, 2560 × {portal applicant, back-office
  reviewer, back-office admin}. Check:
  - no horizontal scroll
  - the active item is visible
  - the sidebar footer is visible
- **Visual regression**: `toHaveScreenshot` of the shell (masked content) in light and dark, expanded and collapsed.
- **Keyboard**:
  - Tab order: skip link → sidebar → top bar → main.
  - ⌘B toggles; Esc closes the medium-tier sheet and returns focus to the trigger.
  - Arrow keys are _not_ trapped in the nav. Links are a plain tab sequence, as in the GOV.UK and APG landmark patterns.
- **2.4.11**: tab through a long form with the header and bottom bar present, and assert that the focused rect is inside
  the unobscured viewport. The existing P2 acceptance test is extended to the new header height.
- **axe** on every tier and in both themes. Check contrast of the active pill, badges and the collapsed tooltip.
- **Locales**: run the matrix once in `fr` and `rw`, and assert there is no text overflow in nav, breadcrumbs or the
  account menu.
- **Update existing specs**:
  - `mobile.spec.ts`: the More sheet loses its account block.
  - `header.spec.ts`: public pages are unaffected; confirm.
  - Add `shell.spec.ts`.

---

## 6. Files

| File                                                                                   | Change                                                                                                                 |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/shell.ts` (new)                                                | `ShellPrefs` schema and the cookie name                                                                                |
| `apps/web/src/app/globals.css`                                                         | Layout tokens, density overrides, scroll-padding, avatar tokens                                                        |
| `apps/web/src/components/ui/sidebar.tsx` (new)                                         | Sidebar primitive (S1)                                                                                                 |
| `apps/web/src/components/layout/app-shell.tsx`                                         | Grid and inset rewrite, reads prefs and badge counts (S2)                                                              |
| `apps/web/src/components/layout/app-nav.tsx`, `nav-link.tsx`                           | Built on `SidebarMenuButton`; the rail variant is removed                                                              |
| `apps/web/src/components/layout/top-bar.tsx` (new), `breadcrumbs.tsx` (new)            | S4                                                                                                                     |
| `apps/web/src/components/layout/area-switcher.tsx` (new)                               | S3                                                                                                                     |
| `apps/web/src/components/layout/account-menu.tsx` (new), `sidebar-user-card.tsx` (new) | Replace `user-menu.tsx` in the app shell (the public header keeps `UserMenu`, now a thin wrapper around `AccountMenu`) |
| `apps/web/src/components/layout/more-sheet.tsx`                                        | Nav tiles only, plus the area switch                                                                                   |
| `apps/web/src/components/layout/page-container.tsx` (new)                              | Width variants                                                                                                         |
| `apps/web/src/components/layout/pilot-banner.tsx`                                      | Lives inside the content panel                                                                                         |
| `apps/web/src/components/ui/avatar.tsx`                                                | Curated palette                                                                                                        |
| `apps/web/src/config/navigation.ts`                                                    | Groups, `badge`, the cross-links removed                                                                               |
| `apps/web/src/app/(portal)/**/page.tsx`, `(backoffice)/**/page.tsx`                    | Wrap in `PageContainer`; grids switch to container queries                                                             |
| `apps/web/messages/{en,fr,rw}.json`                                                    | New `nav.*` and `account.*` keys                                                                                       |
| `apps/web/e2e/shell.spec.ts` (new), `mobile.spec.ts`                                   | S7                                                                                                                     |
| `docs/adr/ADR-011-app-shell.md` (new)                                                  | S0                                                                                                                     |

---

## 7. Risks and decisions for review

| Item                                                                                         | Recommendation                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inset panel vs. edge-to-edge content**                                                     | Inset. It gives the clearest "page" plane in a flat system and matches Linear, Vercel and shadcn `inset`. It costs 8 px of margin, which is irrelevant at ≥ 768 px.                                   |
| **Banner inside the panel vs. a dev chip in the top bar**                                    | The banner goes inside the panel for the pilot (a legal and expectation notice). For staff-only dev mode, the chip.                                                                                   |
| **Language in both the top bar and the account menu**                                        | Yes. It's a trilingual public service and the flag menu is one tap. The duplication is intentional.                                                                                                   |
| **Sidebar as a nested scroller vs. document scroll for main**                                | Document scroll for the page. The sidebar content scrolls independently inside its sticky column. Nested main scrollers break iOS address-bar collapse, Next scroll restoration and `scroll-padding`. |
| **Badge freshness** (counts come from the layout, which doesn't re-run on client navigation) | `router.refresh()` after mutating actions. If reviewers need live counts, add a 60 s visible-tab poll like `NotificationBell`'s. Don't poll by default.                                               |
| **Parallel sessions**                                                                        | `app-shell.tsx`, `navigation.ts` and `globals.css` are hot files. Land S1–S2 in one PR before S3–S5 branch off.                                                                                       |
| **Saved views / favourites** (P2 §6.1 "Sidebar plus saved views")                            | Out of scope. The grouped IA plus ⌘K covers the long tail. Revisit after back-office usability tests.                                                                                                 |
