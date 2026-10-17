# ADR-011 — Authenticated shell: inset layout, collapsible sidebar, viewer preferences

**Status:** Proposed · **Amends:** UI_MODERNIZATION_PLAN §6.1 · **Refs:** UX-001, UX-003, FR-PORTAL-001,
FR-RPT-001, WCAG 2.2 AA (2.4.11, 2.5.3, 2.5.8, 3.2.6) · **Plan:** [APP_SHELL_PLAN](../APP_SHELL_PLAN.md),
[APP_SHELL_IMPLEMENTATION](../APP_SHELL_IMPLEMENTATION.md)

**Problem.** The portal and back-office shell had three competing surfaces and a sidebar that couldn't collapse. Its
account controls were split across three components, back-office navigation was one flat list, and every page used the
same width.

**Decision.**

- **Inset layout.** A full-height sidebar sits on a dimmer plane (`--sidebar`). The page is one panel beside it
  (`bg-background`, rounded, with a hairline at ≥ md). The top bar lives inside the panel. The page scrolls with the
  document, not in a nested scroller: that keeps the mobile address-bar collapse, Next scroll restoration and
  `scroll-padding` working. The sidebar scrolls on its own inside its sticky column.
- **Tiers.**
  - Below 48rem: bottom tab bar (unchanged).
  - 48–64rem: icon rail; the trigger opens the full sidebar as a modal sheet.
  - 64–80rem: collapsed by default.
  - ≥ 80rem: expanded by default.
  - At ≥ 64rem an explicit toggle (button, edge rail or ⌘B / Ctrl+B) overrides the default.
- **Preferences** (`@rebp/contracts` `ShellPrefs`) go in one cookie, `rebp_shell`: `sidebar` (auto/expanded/collapsed),
  `density` and `width`. The server reads it and sets `data-*` attributes on the shell root, so CSS (the `sb-collapsed:`
  variant) renders the first paint correctly without JS. The client writes the cookie directly; there is no server round
  trip because it is cosmetic and holds no PII.
- **Account space vs. service space.** The area switcher (Portal ↔ Back office) and the navigation are service space.
  The identity card in the sidebar footer, and the avatar in the top bar on phones, open one account menu: area, settings
  links, theme, language, layout, help and sign out. Theme leaves the top bar. Language stays there too, because the
  service is trilingual.
- **Banner.** The pilot/dev banner moves inside the content panel, so the sidebar always owns the full viewport height.
- **Width.** The default measure is 72rem. Data-heavy pages opt into 96rem by rendering `<PageWidth wide />`. The viewer
  may choose full width.

**Trade-offs.**

- An 8 px inset margin at ≥ md.
- Nav counts come from the layout, so they refresh on navigation and `router.refresh()`, not live.
- The collapsed state hides labels; tooltips and accessible names carry them.

## Amendment v2 (2026-10-16) — 2026 parity

- **Resizable sidebar.** `ShellPrefs.sidebarWidth`: 224–320 px, default 256, clamped on parse. The shell root renders it as
  `--sidebar-w`, so the first paint is right. The sidebar's inner edge is a WAI-ARIA window splitter (`role="separator"`):
  - pointer: drag to resize, double-click to reset, click to collapse or expand; dragging 48 px past the minimum collapses
    to the rail;
  - keyboard: ←/→ change the width by 16 px, Home/End jump to the limits, Enter collapses or expands.

  While dragging, the width transition is off and the width is written to a CSS variable, not React state.

- **Floating mobile bar.** The phone tab bar is a floating, opaque pill, inset 12 px and lifted above the home indicator. It
  has the overlay shadow (floating chrome) and no glass. `--bottom-nav-h` follows it, so content and focus clear it.
- **Command palette.**
  - Before anything is typed it shows the five most recent pages (not the current one).
  - Typed queries also match letters in order ("wrk q" finds "Work queue"), ranked after exact substring matches.
  - Recents are stored per account in `localStorage` (a per-viewer convenience) and cleared on sign-out.
- **Not adopted: translucent "glass" chrome.** Contrast is unpredictable over moving content (early betas of Apple's
  Liquid Glass measured about 1.5:1). Surfaces stay flat and opaque (ADR-009 v3).

## Amendment v3 (2026-10-17) — navigation styling and My access

- **Icons:** outline throughout, Microsoft Fluent 2 Regular glyphs. They are drawn at a medium weight through an
  `icon-medium` utility: a 0.4 px same-colour stroke takes the 1 px outlines to about 1.4 px, so they don't read faint
  at 20 px. The current page keeps the outline glyph, coloured brand blue (≥ 3:1 on the selection pill, tested). Its
  label stays foreground and semibold, so text contrast stays at full strength.
- **Rows:** 44 px tall with 14 px side padding and 16 px corners (rounded, not pills). There is no side indicator bar.
  The area switcher and the account card share the radius.
- **My access is staff-only.**
  - The account link and settings tab are capability-filtered (`backoffice.access`), via `accountLinksFor()`.
  - The page uses `requireCapability("backoffice.access")`, so applicant-side accounts get `/forbidden`.
  - The forbidden page offers "My access" only to people who can open it.
