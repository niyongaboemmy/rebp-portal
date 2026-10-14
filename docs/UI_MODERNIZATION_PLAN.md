# UI/UX Modernisation Plan — REBP Portal

| Item        | Value                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document ID | REBP-PORTAL-UX-001                                                                                                                                      |
| Version     | 1.0 (draft for design and tech-lead review)                                                                                                             |
| Date        | 2026-10-14                                                                                                                                              |
| Baseline    | [SRS](SRS.md) §11 (UX-001…017), §14 (NFR-PERF, NFR-USE) · [ADR-008](adr/ADR-008-frontend-foundation.md) · [Implementation plan](IMPLEMENTATION_PLAN.md) |
| Audience    | Front-end engineers and designers implementing the portal UI                                                                                            |
| Status      | Proposed — the colour, type and locale-routing decisions need ADR-009 and ADR-010 before Phase 1 starts                                                 |

---

## 1. Summary

The foundation is sound: Tailwind v4 with OKLCH tokens, Radix primitives, next-intl, a light and dark theme, 44 px targets and axe checks in E2E. What the portal lacks is a **visual language for status and progress**, a **mobile-native shell**, and **public pages that are discoverable**. Today it explains itself in paragraphs where it should show a ring, a timeline or a number.

This plan changes the portal in eight phases. Each phase can ship on its own and has its own acceptance criteria.

| Phase  | Theme                         | Main outcome                                                                                          | Depends on                    |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| **P0** | Design tokens and decisions   | New palette (Rwanda-derived emerald), near-black dark theme, motion and type tokens, ADR-009/010      | —                             |
| **P1** | Component library             | ~25 reusable primitives, including lightweight SVG data-viz (ring, meter, sparkline, timeline)        | P0                            |
| **P2** | App shell and navigation      | Mobile bottom tab bar, adaptive sheets, command palette, view transitions                             | P1                            |
| **P3** | Public experience and SEO     | Visual landing page, register search, verification page, eligibility quiz, sitemap, JSON-LD, hreflang | P1, P2                        |
| **P4** | Authentication and onboarding | Shorter sign-up, OTP autofill, passkey-ready, first-run tour                                          | P1                            |
| **P5** | Applicant workflows           | Dashboard, task-list wizard, camera upload, MoMo payment, status timeline, licence wallet             | P1–P2, domain work            |
| **P6** | Back office                   | Work queue, split-screen review console, decision console, analytics dashboards                       | P1–P2, domain work            |
| **P7** | Polish, PWA and performance   | Offline drafts, installability, motion polish, performance budget enforcement                         | P2–P6                         |
| **P8** | Verification                  | WCAG 2.2 AA audit, pseudo-localisation, usability tests (SUS ≥ 75)                                    | runs alongside, gates release |

P0–P4 are UI-only and can start now. P5 and P6 restyle and build screens as the domain work packages in the implementation plan (WP-2.x, WP-3.x) land. They must not block those work packages.

---

## 2. Context that shapes the design

### 2.1 Who uses it, and on what

- **Mostly phones, mostly Android.** In August 2026, Android had 78% of Rwanda's mobile OS share (iOS 21.7%), with Android 12–13 most common ([StatCounter](https://gs.statcounter.com/os-market-share/mobile/rwanda)). Design and test on a **360 × 800 mid-range Android over throttled 3G first**. Desktop comes second, except in the back office.
- **Data costs money.** Mobile data costs $0.41–0.81/GB and internet penetration is about 34% ([DataReportal 2026](https://datareportal.com/reports/digital-2026-rwanda)). Every kilobyte, font file and animation library has to justify itself, which is why the [§5.4 budget](#54-performance-budgets-nfr-perf-001005) exists.
- **Many people get help.** Unassisted online use of IremboGov was 41% in 2023 ([Cenfri](https://cenfri.org/articles/digitisation-of-government-services-in-rwanda-lessons-from-the-data/)). Agents and officers will often operate the UI for applicants (FR-PORTAL-020). Screens need clear reference numbers, must be easy to hand over, and must print well.
- **Personas** (SRS §2.2):
  - Aline (22, phone only, MoMo, Kinyarwanda) sets the **minimum** experience.
  - Officer Jean (30+ files a day) sets the **expert** experience.

### 2.2 Design references: what we borrow, and from where

| Source                            | Borrow                                                                                                                                                                                                                                                               | Where it applies               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **GOV.UK Design System**          | One question per page ([question pages](https://design-system.service.gov.uk/patterns/question-pages/)), task list, [check answers](https://design-system.service.gov.uk/patterns/check-answers), confirmation page with the reference number, "Continue" not "Next" | Wizard, eligibility quiz, auth |
| **Apple HIG**                     | 44 pt targets, semantic colours that adapt to dark mode, base and elevated surfaces, Reduce Motion, sheets with detents, large titles that collapse on scroll                                                                                                        | Shell, sheets, dark theme      |
| **Material 3 Expressive**         | Spring motion and emphasised easing, a few hero actions per screen (FAB), stronger shape and size contrast, tonal surfaces in dark mode                                                                                                                              | Motion tokens, dashboard, FAB  |
| **Google (Pay / Wallet / Files)** | Glanceable cards with one number, a pass-style credential, a bottom navigation bar                                                                                                                                                                                   | Licence wallet, dashboard      |
| **Meta (Facebook Lite)**          | Design for 2G and 3G, skeletons over spinners, optimistic UI                                                                                                                                                                                                         | Loading strategy, performance  |
| **Irembo / IremboPay**            | Mobile-money first, familiar "check your phone" payment pattern, printable references                                                                                                                                                                                | Payment, receipts              |

### 2.3 "Minimal text, more graphics", applied responsibly

The brief asks for fewer words and more interactive visuals. That suits a status-heavy product: a licence is a countdown, an application is progress, a queue is a distribution. Words stay where they carry legal or decision weight. The rules:

1. **Show state as graphics, explain on demand.** Progress, eligibility, validity, SLA and counts become rings, meters, timelines and numbers. Explanations move into a help sheet behind an ⓘ button (FR-WIZ-012).
2. **One headline number per card.** Use a large figure with a short label, not a sentence.
3. **Icons always have a label.** Icon-only controls need an accessible name and a tooltip. Bottom-bar items show both icon and label.
4. **Never minimise legal text.** Declarations (Section J), reasons for rejection and data-protection notices stay verbatim (SRS §11.1 principle 5).
5. **Colour is never the only signal** (WCAG 1.4.1). Every status combines **icon + label + colour**.
6. **Every chart has a text equivalent:** a summary sentence for screen readers and a "View as table" toggle.

---

## 3. Audit of the current UI

These findings come from reading `apps/web/src` on `feat/project-foundation`. Contrast ratios were computed from the OKLCH tokens in `globals.css`.

| #   | Finding                                                                                                                                                 | Evidence                                               | Severity                     | Fixed in     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------- | ------------ |
| A1  | Input borders are **1.43:1** on cards (light) and **1.63:1** (dark). WCAG 1.4.11 requires 3:1 for UI component boundaries.                              | `--input: oklch(0.88 0.012 250)`                       | **High (WCAG fail)**         | P0           |
| A2  | Warning badge text is **3.7:1** on its soft background, below 4.5:1 for small text.                                                                     | `text-warning` on `bg-warning-soft` in `badge.tsx`     | **High (WCAG fail)**         | P0           |
| A3  | The dark theme is navy slate (`#091018`, chroma 0.02), not the near-black the brief asks for. Surfaces are only 0.04 L apart, so elevation is weak.     | `.dark --background`                                   | Medium                       | P0           |
| A4  | Mobile navigation is a hamburger drawer only. The main destinations are two taps away and the menu sits at the top, out of thumb reach.                 | `mobile-nav.tsx`, `app-shell.tsx`                      | Medium                       | P2           |
| A5  | The sticky header can hide focused elements (WCAG 2.2 **2.4.11**). There is no `scroll-padding-top`.                                                    | `globals.css`                                          | Medium                       | P0           |
| A6  | No `robots`, `sitemap`, web manifest, OG images, canonical or hreflang. `/register` and `/eligibility` are placeholders.                                | `src/app/` (no `public/` folder)                       | High for the public register | P3           |
| A7  | The landing page is mostly copy (4 sections, about 15 sentences) with static lists and no interaction.                                                  | `(public)/page.tsx`                                    | Medium                       | P3           |
| A8  | The dashboard shows hard-coded `0` counters and paragraph cards.                                                                                        | `(portal)/dashboard/page.tsx`                          | Medium                       | P5           |
| A9  | Developer milestone text ("planned for D4 — WP-3.1") is shown to staff.                                                                                 | `backoffice/page.tsx`, `BACKOFFICE_SECTIONS.milestone` | Low                          | P6           |
| A10 | `aria-label="Footer"` is hard-coded English, against the CLAUDE.md i18n rule.                                                                           | `site-footer.tsx:16`                                   | Low                          | P0           |
| A11 | Three font families load (Figtree, Bricolage, JetBrains Mono). The display face costs bytes and reads informal next to Apple- or Google-grade products. | `fonts.ts`                                             | Low                          | P0 (ADR-009) |
| A12 | The reduced-motion rule sets every duration to 0.01 ms, which also removes harmless opacity fades that help orientation.                                | `globals.css`                                          | Low                          | P0           |
| A13 | Dialogs are centred modals on phones. ADR-008 promises bottom sheets, but there is no `ResponsiveDialog`.                                               | `dialog.tsx`                                           | Medium                       | P1           |
| A14 | `theme-color` uses the old palette. There is no `color-scheme` declaration, so native controls and scrollbars stay light in dark mode.                  | `layout.tsx` viewport                                  | Low                          | P0           |

Keep these, because they are good:

- the OKLCH token architecture;
- `cva` variants;
- 44 px button heights on mobile;
- `next/font` subsetting;
- the skip link;
- `useActionForm`;
- the role-filtered navigation config;
- route-level skeletons.

---

## 4. Phase P0 — Design tokens and decisions

**Goal:** a token system that makes any later screen look consistent automatically.
**Effort:** about 2–3 dev-days.
**Files:** `apps/web/src/app/globals.css`, `fonts.ts`, `layout.tsx`, and new files `docs/adr/ADR-009-visual-language.md` and `ADR-010-public-locale-routing.md`.

### 4.1 Primary colour: "Imena Emerald", derived from Rwanda's flag green

**Recommendation:** a deep **emerald green** as the primary colour, with the other two flag colours as supporting roles. **Sky** (a darkened flag blue) is for information and links, and **Sun** (flag yellow) is for highlights and celebration.

Why emerald:

| Criterion            | Emerald (chosen)                                                                                                                           | Flag blue `#00A1DE`                                                          | Current teal                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------- |
| Regional fit         | Taken from the flag green (`#20603D`, PMS 3415), and echoes Rwanda's "green, clean" national identity. Reads as land, growth and property. | Strongly national, but already heavily used by government and telecom brands | Neutral, no regional anchor |
| Trust and regulation | Green signals "valid, licensed, approved", which is the product's core message                                                             | Blue signals trust but is generic                                            | OK                          |
| Accessibility        | `#006d45` gives **6.2:1** on the page background and carries white text at **6.25:1**                                                      | **2.94:1** on white, so it fails for text and buttons                        | 5.6:1                       |
| Distinctiveness      | Recognisably Rwandan without copying a flag or a ministry brand                                                                            | Risk of looking like a ministry or MTN                                       | Generic SaaS look           |

> **Branding guardrail.** D-004 says brand assets (P8) haven't arrived. The regulator is still being settled: NLA with RWAREB is drafting the brokerage rules ([New Times](https://www.newtimes.co.rw/article/37540/news/housing/new-rules-to-regulate-real-estate-brokers)).
>
> - Use the national colours as a **palette inspiration only**.
> - Never use the national coat of arms, the flag graphic, or a ministry's or agency's logo or name until the Professional Body provides approved assets.
> - Because every value is a token, replacing the palette later is a one-file change.

### 4.2 Colour tokens (all contrast values computed, WCAG 2.2)

**Light theme:**

| Token                                 | OKLCH                          | Hex                   | Check                                               |
| ------------------------------------- | ------------------------------ | --------------------- | --------------------------------------------------- |
| `--background`                        | 0.985 0.004 160                | `#f8fbf9`             | —                                                   |
| `--surface-1` (`--card`)              | 1 0 0                          | `#ffffff`             | —                                                   |
| `--foreground`                        | 0.21 0.02 250                  | `#111921`             | 17.0:1 on background                                |
| `--muted-foreground`                  | 0.48 0.018 250                 | `#565f68`             | 6.3:1 on background                                 |
| `--primary`                           | 0.47 0.11 160                  | `#006d45`             | 6.2:1 on background                                 |
| `--primary-foreground`                | 0.99 0.005 160                 | `#f9fdfb`             | 6.25:1 on primary                                   |
| `--primary-soft` / `-soft-foreground` | 0.95 0.035 160 / 0.36 0.08 160 | `#dbf6e7` / `#034a2e` | 9.2:1                                               |
| `--sun` / `--sun-foreground` (accent) | 0.87 0.16 92 / 0.30 0.06 70    | `#fad03e` / `#412805` | 9.3:1. Sun is never used as text on light surfaces. |
| `--sky` (info, links in data)         | 0.50 0.14 245                  | `#0068ad`             | 5.9:1 on white                                      |
| `--success-text`                      | 0.50 0.12 150                  | `#21763c`             | 5.7:1 on white                                      |
| `--warning-text`                      | 0.52 0.12 65                   | `#975800`             | 5.7:1 on white. **Fixes A2.**                       |
| `--danger`                            | 0.54 0.20 27                   | `#c92324`             | 5.6:1 on white                                      |
| `--border` (decorative dividers)      | 0.91 0.008 250                 | `#dde2e6`             | decorative only                                     |
| `--input` (control boundary)          | 0.62 0.015 250                 | `#80878f`             | **3.6:1 on white. Fixes A1.**                       |

**Dark theme: "Ink", near-black with a faint cool tint, never `#000`.** Elevation comes from **lightness steps**, not shadows, following the Material dark-theme guidance and Apple's base and elevated surfaces.

| Token                       | OKLCH           | Hex       | Role / check                                                                       |
| --------------------------- | --------------- | --------- | ---------------------------------------------------------------------------------- |
| `--background`              | 0.165 0.010 258 | `#0c0f13` | page (reads as black, isn't)                                                       |
| `--surface-1` (`--card`)    | 0.198 0.012 258 | `#12161b` | cards, sidebar                                                                     |
| `--surface-2` (`--popover`) | 0.232 0.014 258 | `#191e24` | popovers, sheets, menus                                                            |
| `--surface-3`               | 0.265 0.015 258 | `#21262d` | hover, selected rows, inputs                                                       |
| `--border`                  | 0.30 0.014 258  | `#2a2e35` | hairlines                                                                          |
| `--input`                   | 0.52 0.016 258  | `#636972` | 3.3:1 on surface-1. **Fixes A1.**                                                  |
| `--foreground`              | 0.965 0.004 250 | `#f1f4f6` | 17.4:1 (off-white, not `#fff`)                                                     |
| `--muted-foreground`        | 0.72 0.015 250  | `#9ea6ae` | 6.2:1 on surface-3                                                                 |
| `--primary`                 | 0.78 0.14 160   | `#56d298` | 8.1:1 on surface-3. Text on primary uses `--primary-foreground` `#00170b` (9.9:1). |
| `--sky`                     | 0.74 0.12 235   | `#53b6eb` | 8.3:1                                                                              |
| `--sun`                     | 0.86 0.15 92    | `#f4cd4b` | accent fills only                                                                  |
| `--danger`                  | 0.70 0.17 25    | `#f66d67` | 6.5:1                                                                              |

**Making the dark theme feel "cute" without noise.** The background gets one fixed, very low-opacity ambient glow layer, used only on public and auth pages and dashboard hero areas:

```css
.bg-ambient {
  background:
    radial-gradient(
      60rem 30rem at 85% -10%,
      color-mix(in oklch, var(--primary) 9%, transparent),
      transparent 70%
    ),
    radial-gradient(
      40rem 24rem at -10% 10%,
      color-mix(in oklch, var(--sky) 7%, transparent),
      transparent 70%
    ),
    var(--background);
}
```

Add an optional **Imigongo-inspired geometric pattern** at 3–4% opacity: zig-zag and diamond motifs as a single inline SVG mask, under 1 KB. It adds a Rwandan signature to hero and empty-state surfaces. Keep it off data-dense screens.

**Hierarchy rules:**

| Element             | Colour                                                            | Example                         |
| ------------------- | ----------------------------------------------------------------- | ------------------------------- |
| Main call to action | `--primary` fill. **Exactly one** filled primary button per view. | Continue                        |
| Secondary actions   | Tonal (`--primary-soft`)                                          | Save draft                      |
| Tertiary actions    | Ghost or link                                                     | Cancel                          |
| Destructive actions | Outline in danger, filled only inside the confirmation sheet      | Withdraw                        |
| Status              | Reserved status hues, always with an icon and a label             | Status badges                   |
| Celebration         | `--sun`                                                           | Licence issued, eligibility met |
| Information         | `--sky`                                                           | Hints, informational links      |

Neutrals use hue 250–258, with chroma ≤ 0.02. Brand-tinted neutrals (hue 160) are used **only** for the page background in light mode.

**Status palette (reserved; never reused as chart series):**

| Status   | Light (text / soft bg)      | Icon            | Used for                                   |
| -------- | --------------------------- | --------------- | ------------------------------------------ |
| Good     | success-text / success-soft | `CircleCheck`   | ACTIVE, Verified, Approved                 |
| Warning  | warning-text / warning-soft | `TriangleAlert` | Expiring, Action required, SLA at risk     |
| Critical | danger / danger-soft        | `OctagonX`      | Suspended, Revoked, Rejected, SLA breached |
| Info     | sky / sky-soft              | `Info`          | Under review, Pending                      |
| Neutral  | muted-fg / muted            | `CircleDashed`  | Draft, Expired draft, Superseded           |

Map each status enum (`ApplicationStatus`, `LicenseStatus`, `ConfirmationStatus`) to exactly one tone in **`packages/contracts/src/status-tones.ts`**. Every badge, timeline node and chart then reads from that one source ("contracts first").

**Chart palette:**

- **Categorical series:** the validated 8-slot default from the `dataviz` reference palette, assigned in fixed order and never cycled. It is validated in both themes for CVD separation.
- **Sequential magnitude** (heatmaps, district maps): a single-hue emerald ramp, 100→700. Validate it with `validate_palette.js --ordinal` against both surfaces before use.
- **Before shipping any palette change, run the validator** and record the output in ADR-009.

### 4.3 Typography (ADR-009 amends ADR-008)

- **One family: Figtree** (variable) for UI and headings, plus JetBrains Mono for reference numbers, licence numbers and OTPs.
  - **Drop Bricolage Grotesque.** That removes one font download (measure the saving with the bundle analyser) and gives the calmer, system-like tone of Apple and Google products.
  - Headings use weight 650–700 with tracking −0.02 em.
  - Turn on tabular numerals for all figures: `font-variant-numeric: tabular-nums` on `.num`.
- **Scale:** 4 px baseline, major-second ratio on mobile and major-third on desktop, applied through `clamp()`.

| Token           | Mobile → desktop | Use                                               |
| --------------- | ---------------- | ------------------------------------------------- |
| `text-caption`  | 12 → 12          | Meta, legends                                     |
| `text-sm`       | 14 → 14          | Secondary text                                    |
| `text-base`     | **16** → 16      | Body and **all inputs** (16 px prevents iOS zoom) |
| `text-title`    | 18 → 20          | Card titles                                       |
| `text-headline` | 22 → 28          | Page titles                                       |
| `text-display`  | 30 → 48          | Hero only                                         |
| `text-metric`   | 32 → 44          | KPI numbers (tabular, weight 700)                 |

- Add `hyphens: auto; overflow-wrap: anywhere;` to headings and labels. Kinyarwanda has long agglutinated words that won't wrap.
- **Line length** is 45–75 characters (`max-w-prose`) for reading text.

### 4.4 Space, shape, elevation

- **Spacing:** a 4 px grid. Use 16 px as the mobile gutter, 24 px on tablet and 32 px on desktop. Section rhythm is 24/32/48.
- **Radii:**

  | Element            | Radius                        |
  | ------------------ | ----------------------------- |
  | Controls           | 10 px                         |
  | Cards              | 16 px                         |
  | Sheets and dialogs | 24 px (top corners on mobile) |
  | Chips and avatars  | pill                          |

  Keep the existing `--radius` scale but rebase it to these values.

- **Elevation:** light mode uses three shadow levels (`--shadow-1/2/3`). Dark mode uses **no shadows**; it uses the surface lightness steps above plus a 1 px top inner highlight (`inset 0 1px 0 oklch(1 0 0 / 0.04)`) on raised cards.

### 4.5 Motion tokens

Motion is CSS-first, so the runtime cost is close to zero. Easings follow the Material 3 emphasised set; durations stay short because devices are low-end.

```css
:root {
  --ease-standard: cubic-bezier(0.2, 0, 0, 1); /* most transitions */
  --ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1); /* elements arriving */
  --ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15); /* elements leaving */
  --ease-spring: linear(
    0,
    0.38 9%,
    0.81 20%,
    1.02 31%,
    1.07 38%,
    1.03 49%,
    0.99 62%,
    1
  ); /* overshoot for delight */
  --dur-1: 100ms; /* press, toggle */
  --dur-2: 160ms; /* hover, fade, exit */
  --dur-3: 240ms; /* enter, expand */
  --dur-4: 360ms; /* sheet, page, chart draw */
  --dur-5: 600ms; /* number count-up, celebration */
}
```

Rules:

- Animate **only `transform` and `opacity`** (and SVG `stroke-dashoffset` for rings).
- Exits are faster than entrances.
- Stagger lists at 30 ms per item, with **at most 8 items** staggered.
- **Replace the global reduced-motion kill (A12):**
  - Under `prefers-reduced-motion: reduce`, set the transform-based keyframes to `none` and drop durations to `--dur-1`.
  - Keep opacity cross-fades.
  - Skip count-up animations and render the final value immediately.

### 4.6 Other P0 fixes

- Add `scroll-padding-top: calc(var(--header-h) + 8px)` to `html` (**A5**, WCAG 2.4.11). Do the same for `scroll-padding-bottom` once the bottom bar exists (P2).
- Set `color-scheme: light` and `color-scheme: dark` on the two themes, and update `viewport.themeColor` to `#f8fbf9` and `#0c0f13` (**A14**).
- Localise the footer `aria-label` (**A10**).
- Add an ESLint rule (`react/jsx-no-literals` scoped to `aria-*`, or a custom lint) so literal accessible names fail CI.

### 4.7 Acceptance

- [ ] ADR-009 (visual language: colour, type, motion, data-viz palette) and ADR-010 (public locale routing, see §7.6) are accepted.
- [ ] `globals.css` defines only the semantic tokens above. No raw colours remain in components (`grep -E "#[0-9a-f]{3,6}|oklch\(" src/components` matches only `globals.css`).
- [ ] A **token contrast test** (Vitest) converts every documented foreground/background pair from OKLCH and asserts the ratio. A1 and A2 are covered.
- [ ] axe passes on all existing pages in both themes.
- [ ] A `/dev/design` page (dev-only) shows every token, type style, motion curve and component state in both themes. It is the living style guide.

---

## 5. Phase P1 — Reusable component library

**Goal:** every later screen is assembled from these pieces, with no one-off styling.
**Effort:** about 5–7 dev-days.
**Location:** `src/components/ui/` for primitives, and a new `src/components/data/` for data-viz and status. All of them are Server Component–safe unless marked ⓒ (client).

### 5.1 New or upgraded primitives

| Component               | Purpose                                                                                                                                      | Key API / behaviour                                              | SRS                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------ |
| `Button` (upgrade)      | Adds the `tonal` variant and a `fab` size. Press scale is 0.97 at `--dur-1`.                                                                 | `variant: primary\|tonal\|outline\|ghost\|danger\|link`          | UX-001             |
| `IconButton`            | Icon-only with a **required** `label` (it becomes `aria-label` and the tooltip)                                                              | `label: string` is enforced by its type                          | 2.5.8              |
| `ResponsiveDialog` ⓒ    | A centred dialog at `sm` and up; a **bottom sheet with drag handle and detents** below. Fixes **A13**.                                       | `<ResponsiveDialog title description snap={["content","full"]}>` | UX-001             |
| `Sheet` (upgrade) ⓒ     | Adds a `bottom` side, safe-area padding and a drag-to-dismiss gesture **with a close button as the single-pointer alternative** (WCAG 2.5.7) |                                                                  |                    |
| `Segmented` ⓒ           | iOS-style segmented control with an animated thumb (FLIP via `transform`)                                                                    | Built on Radix ToggleGroup                                       |                    |
| `Chip` / `FilterChip` ⓒ | Filters in the register and queue; horizontally scrollable on mobile                                                                         |                                                                  | FR-BO-001          |
| `StatusBadge`           | Reads tone and icon from `status-tones.ts`; always icon + label                                                                              | `<StatusBadge status="ACTION_REQUIRED" />`                       | 1.4.1              |
| `Field` (upgrade)       | Floating-free top label, helper text, an ⓘ help trigger and inline error with an icon                                                        | Keeps the current ARIA wiring                                    | FR-WIZ-006         |
| `ErrorSummary`          | GOV.UK-style list at the top of the form. It takes focus on a failed submit and its links focus each field.                                  |                                                                  | FR-WIZ-006         |
| `DateInput`             | Three fields (DD / MM / YYYY) with `inputmode="numeric"`, plus an optional calendar popover. Typed entry comes first (UX-006).               |                                                                  | UX-014             |
| `PhoneInput`            | A fixed `+250` prefix chip, `inputmode="tel"`, formatting as `7XX XXX XXX`, and validation against MTN and Airtel prefixes                   |                                                                  |                    |
| `AddressCascade` ⓒ      | Province → District → Sector → Cell → Village as chained comboboxes, each with search                                                        |                                                                  | C-08               |
| `Combobox` ⓒ            | Typeahead for firm, supervisor, institution. Radix Popover plus `cmdk`.                                                                      |                                                                  | UX-006             |
| `OtpInput` (upgrade)    | `autocomplete="one-time-code"`, paste across all boxes, Web OTP API on Android                                                               |                                                                  | 3.3.8              |
| `FileDrop` ⓒ            | Desktop drag-and-drop **plus a "Choose file" button**, mobile `capture="environment"` camera, preview, replace, progress ring, scan status   |                                                                  | UX-007, 2.5.7      |
| `Stepper` / `TaskList`  | Task-list overview (not started, in progress, done, error) and a compact "Step 3 of 9" progress header                                       |                                                                  | FR-WIZ-005, UX-004 |
| `SummaryList`           | Key–value rows with "Change" links, for the check-answers step                                                                               |                                                                  | FR-WIZ-008         |
| `CopyField`             | Monospace value plus a copy button with tick feedback, for reference and licence numbers (uses the existing `useCopy`)                       |                                                                  |                    |
| `Tooltip` ⓒ             | Radix tooltip; on touch it opens on long-press and stays reachable by keyboard                                                               |                                                                  |                    |
| `EmptyState` (upgrade)  | Illustration slot (Imigongo-pattern spot art) plus **one** action                                                                            |                                                                  | UX-009             |
| `Skeleton` presets      | `SkeletonCard`, `SkeletonRow`, `SkeletonStat` that match the real layouts, so nothing shifts on load (CLS)                                   |                                                                  | UX-009             |
| `Toast` (sonner)        | Bottom-centre placement on mobile, above the tab bar. Undo action for reversible operations.                                                 |                                                                  |                    |

### 5.2 Data-viz and status components (`src/components/data/`)

These are **hand-rolled SVG, about 1–2 KB each, server-renderable and animated with CSS.** The applicant portal therefore needs no chart library (NFR-PERF-005). Each one ships with a `<span class="sr-only">` summary and passes the dataviz checks in §4.2.

| Component         | Visual                                                                                                                                                                                                  | Used for                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ProgressRing`    | A circular arc that animates `stroke-dashoffset` from 0 to the value at `--dur-4`, with the value in the centre                                                                                         | Application completion %, document checklist (5/7)                          |
| `ValidityRing`    | The ring counts down days remaining. Its tone changes at 60 and 30 days (good → warning → critical) and it shows an icon as well.                                                                       | Licence wallet, dashboard                                                   |
| `Meter`           | A horizontal bar with a target marker                                                                                                                                                                   | Eligibility: "2 y 7 m of 3 y" (FR-WIZ-007), supervision ratio (FR-FIRM-012) |
| `StatTile`        | A big tabular number, label, delta chip (▲ 12%) and optional sparkline. Count-up runs once on viewport entry.                                                                                           | Dashboards                                                                  |
| `Sparkline`       | 2 px line with an end dot, fixed y-baseline, no axes, hover tooltip on desktop                                                                                                                          | Trends in tiles                                                             |
| `StatusTimeline`  | Vertical on mobile, horizontal at `lg`. Nodes use status tones, the current node pulses (disabled under reduced motion), and the SLA appears as "Review usually starts within 3 working days".          | FR-PORTAL-002                                                               |
| `StateJourney`    | A compact five-dot pipeline (Draft → Paid → Confirmed → Review → Decision) that fits in a card row                                                                                                      | Application cards                                                           |
| `ChecklistGrid`   | Document tiles with a thumbnail and state icon                                                                                                                                                          | Section I checklist                                                         |
| `CategoryLadder`  | An interactive ladder for RERA → FSLA → REA → Broker → Associate/Managing/Principal, plus REBF. Tapping a rung reveals requirements in a sheet; "You are here" and "Eligible from 12 Mar 2027" markers. | Landing, categories, eligibility (FR-PORTAL-007, persona Eric)              |
| `DistributionBar` | A single stacked bar with a 2 px surface gap between segments, a legend and a table toggle                                                                                                              | Queue by status, register by category                                       |

The **back-office analytics** (§10) need axes, crosshairs and many series, and use **shadcn charts (Recharts)**, loaded only on `/backoffice/reports` through `next/dynamic`. They never ship in the applicant bundle.

### 5.3 Motion components

- `<Reveal>`: a server-safe wrapper that adds `data-reveal`. A tiny shared `IntersectionObserver` (under 0.5 KB, client) toggles a class for fade-up on scroll. It is used on public pages only.
- `<CountUp>` ⓒ: uses `requestAnimationFrame` to count to the value over `--dur-5` and respects reduced motion.
- **Library choice:** don't add `motion` (Framer) in P1. CSS, View Transitions and these hooks cover the needs. Reconsider in P7 **only** for physics-driven drag gestures on bottom sheets. If it is adopted, import it as `LazyMotion` + `m` (about 5 KB) and follow `minimumReleaseAge`.

### 5.4 Performance budgets (NFR-PERF-001/005)

| Budget                           | Limit                                                              | Enforced by                                            |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| Applicant initial route JS       | ≤ 200 KB gzip (SRS); **target 150 KB**                             | `@next/bundle-analyzer` + CI size check (`size-limit`) |
| Fonts                            | ≤ 2 files on first paint (Figtree variable + Mono subset)          | review                                                 |
| LCP on Moto G-class over Fast 3G | ≤ 2.5 s                                                            | Lighthouse CI (mobile preset)                          |
| INP                              | ≤ 200 ms                                                           | Lighthouse and web-vitals RUM                          |
| CLS                              | ≤ 0.05                                                             | Lighthouse                                             |
| Hero imagery                     | SVG only, or AVIF/WebP ≤ 40 KB, `priority` only on the LCP element | review                                                 |

### 5.5 Acceptance

- [ ] Every component is in `/dev/design` with all states (default, hover, focus, disabled, loading, error) in both themes, at 360 px and 1280 px.
- [ ] Each component has a unit test for its ARIA contract: role, name, keyboard.
- [ ] `ResponsiveDialog`, `FileDrop`, `Segmented` and `Combobox` pass keyboard-only and screen-reader smoke tests (TalkBack + Chrome, VoiceOver + Safari).

---

## 6. Phase P2 — App shell and navigation

**Goal:** a shell that feels native on a phone and efficient on a desktop.
**Effort:** about 3–4 dev-days.

### 6.1 Adaptive navigation

| Viewport        | Applicant portal                                                                                                                                                                                                                                                               | Back office                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `< md` (phones) | **Bottom tab bar** (thumb zone). Four tabs (Home, Applications, Licences, More) plus a centre **FAB "New application"** on the dashboard. A compact top bar holds the title, notifications bell and avatar. "More" opens a sheet with the secondary links, theme and language. | Bottom bar: Queue, Decisions, Search, More (filtered by capability) |
| `md`–`lg`       | **Navigation rail**: 72 px of icons with labels underneath                                                                                                                                                                                                                     | Rail                                                                |
| `≥ lg`          | Full sidebar (as today), collapsible to the rail, with the state remembered in `localStorage`                                                                                                                                                                                  | Sidebar plus saved views                                            |

Implementation notes:

- `BottomNav` is a client component that **imports `PORTAL_NAV` itself**, per the CLAUDE.md rule about not passing icons across the server/client boundary. Add a `mobile: "tab" | "more"` field to `NavItem` so one config drives every layout.
- Respect safe areas with `padding-bottom: env(safe-area-inset-bottom)` and `viewport-fit=cover`. Set `scroll-padding-bottom` so focused fields are never hidden behind the bar (WCAG 2.4.11).
- Hide the bar while the on-screen keyboard is open (`visualViewport` resize) and inside the wizard, which has its own sticky action bar.
- **Collapsing large title:** the page title starts at headline size and shrinks into the top bar on scroll (iOS pattern). Use CSS scroll-driven animation (`animation-timeline: scroll()`) with a static fallback.
- **Badges** on tabs show counts of required actions (FR-PORTAL-001), announced as "Applications, 2 actions needed".

### 6.2 Global features

- **Command palette** (`⌘K` / `Ctrl+K`, plus a search icon on mobile). Built with `cmdk` inside `ResponsiveDialog`, so it is a full-height sheet on phones. Scope: navigation, "Find application by reference", "Verify licence…", theme, language. For back-office users it also includes "Go to queue item by reference". This is lazy-loaded and costs nothing until it opens.
- **Notification centre:** a bell with an unread dot and a sheet listing items grouped by Today and Earlier, with swipe-to-mark-read (button alternative included). This is the in-app channel for SRS §9.3.
- **Page transitions:** use React `<ViewTransition>` in each `page.tsx`, as recommended in the [Next.js view-transitions guide](https://nextjs.org/docs/app/guides/view-transitions).
  - Add `transitionTypes={['nav-forward']}` / `['nav-back']` on links for directional slides: exit 150 ms, enter 210 ms, 24 px offset on mobile.
  - Pin the top bar and bottom bar with `view-transition-name` so they don't animate.
  - Shared-element morphs: an application card expands into the detail header, and the licence card into the wallet view.
  - Under reduced motion, only a cross-fade runs. Unsupported browsers simply don't animate.
  - Check the exact Next 16.4 API before building; an older `experimental.viewTransition` flag existed.
- **Theme and language:** keep both dropdowns in the header on desktop. On mobile, move them into the "More" sheet as `Segmented` controls: Light / Dark / System, and EN / RW / FR.
- **Consistent help** (WCAG 2.2 **3.2.6**): a "Help" entry sits in the same place on every page (the More sheet or the sidebar footer) and opens the contextual help sheet.
- **Pilot banner:** make it dismissible per session and keep it to one line, so it doesn't take space from a 360 px viewport.

### 6.3 Acceptance

- [ ] On a Pixel 7 Playwright profile, every primary destination is one tap away and there is no horizontal scroll from 320 px to 2560 px (UX-001).
- [ ] A Playwright test tabs through a long form with the bottom and top bars present, and asserts that the focused element's rect sits inside the unobscured viewport (2.4.11).
- [ ] View transitions run only when `prefers-reduced-motion: no-preference`. This is tested with `page.emulateMedia`.

---

## 7. Phase P3 — Public experience and SEO

**Goal:** the public register and verification pages become the most visited and best-ranked pages for "verify broker Rwanda". The landing page converts with very little copy.
**Effort:** about 5–6 dev-days (UI). The register search API is part of WP-4.x.

### 7.1 Landing page (minimal text, interactive)

Each section uses at most one headline and one line of text.

1. **Hero:**
   - Headline plus one subline.
   - The **verify search field** is the hero element. It is big, auto-focus is off on mobile, and there is a "Scan QR" camera button (`BarcodeDetector` where supported, with a typed number as fallback).
   - A primary CTA "Start application" and a tonal CTA "Am I eligible?".
   - The ambient background and Imigongo pattern sit behind.
2. **Live trust strip:** three `StatTile`s with count-up: licensed practitioners, registered firms, median days to decision (KPI from SRS §1.3). They read from a cached public stats endpoint revalidated hourly. Hide the strip until real data exists rather than showing zeros.
3. **Interactive `CategoryLadder`:** replaces the eight text cards. Tapping a rung opens a sheet showing requirements (age, education, experience, supervision) as icon rows, the fee in RWF and the typical timeline.
4. **"How it works":** a four-node horizontal journey (Account → Apply → Pay → Licence) with icons that draws its connector on scroll. Labels only, no body copy.
5. **Licence preview:** an animated mock licence card (a 3D tilt on pointer devices, disabled for touch and reduced motion) showing the QR code and an "Active" status. This shows the outcome rather than describing it.
6. **Footer:** links, language, and help and contact (consistent help).

### 7.2 Public register `/register`

- **Search-first layout:**
  - A sticky search bar with a 250 ms debounce, plus `FilterChip`s (category, status, district) that open sheet filters on mobile.
  - **Results as cards** on mobile: name, category chip, `StatusBadge`, registration number, firm. On desktop, a dense table view is available through `Segmented` (Cards | Table).
- **No bulk export** and rate-limited, per FR-REG-005. Show friendly copy if throttled.
- Every filter state is in the URL query, so results are shareable, the Back button works, and they can be crawled.
- The empty state offers "Report a concern" (FR-REG-007).

### 7.3 Verification page `/check/[licenceNo]` (the QR target, FR-REG-004)

`/verify` is already the signed-in contact-verification route, so the public licence check lives at `/check`.

This is the most important public screen. A consumer standing in front of an agent must understand it in **under two seconds**.

- A **full-bleed status hero** in the status tone, with a large icon and one word: **VALID** / **SUSPENDED** / **REVOKED** / **EXPIRED** / **SUPERSEDED → see current**.
- A live "Checked 14 Oct 2026, 10:42 CAT" timestamp, a tamper-evident seal indicator, and the name, category, firm and expiry date as an icon list.
- A public status history, if configured (FR-RA-002).
- **Fast:** static shell plus a streamed status fragment, no client JS required, and LCP under 1.5 s on 3G.
- Wording shows **only FR-REG-003 public fields**.

### 7.4 Eligibility quiz `/eligibility` (FR-PORTAL-006)

- One question per screen (GOV.UK), using large tappable option cards rather than radio lists, with progress dots at the top.
- The result screen shows:
  - the recommended category on the `CategoryLadder` ("You are here");
  - `Meter`s for experience against the requirement;
  - "Eligible from …" dates;
  - a document checklist to prepare, downloadable or shareable through `navigator.share`.
- Everything is client-side and needs no login. The answers can **seed the wizard** when the user signs up (FR-ACC-009, WCAG 3.3.7 redundant entry).

### 7.5 SEO implementation (Next.js 16)

| Item                                                                     | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metadata                                                                 | `generateMetadata` on every public page, with a unique title of 50–60 characters and description of 140–160 characters. Use a template like `%s · REBP Register`. `metadataBase` comes from `APP_URL`.                                                                                                                                                                                                                                                                 |
| Canonical and hreflang                                                   | `alternates.canonical` plus `alternates.languages` `{ en, rw, fr, "x-default" }` as absolute URLs. This **requires distinct URLs per locale**; see §7.6.                                                                                                                                                                                                                                                                                                               |
| `robots.ts`                                                              | Allow `/`, `/register`, `/check`, `/categories`, `/eligibility`. Disallow `/dashboard`, `/applications`, `/backoffice`, `/settings`, `/api`, `/dev` and the auth routes. Authenticated layouts also set `robots: { index: false }`.                                                                                                                                                                                                                                    |
| `sitemap.ts`                                                             | Static public pages plus a **sitemap index** of practitioner and firm pages, chunked at 50k URLs, with per-URL `alternates.languages`. It includes **only** entries whose owner has not opted out and the law permits (FR-REG-008).                                                                                                                                                                                                                                    |
| Practitioner and firm pages `/register/p/[regNo]`, `/register/f/[regNo]` | Server-rendered and ISR (revalidated on status change through `revalidateTag`; ≤ 5 min per FR-WF-010).                                                                                                                                                                                                                                                                                                                                                                 |
| JSON-LD                                                                  | Site: `GovernmentOrganization` (once the regulator's identity is confirmed; until then `Organization`) and `WebSite` with `SearchAction` pointing to `/register?q={search_term_string}` for a sitelinks search box. Practitioner: `Person` with `hasCredential` → `EducationalOccupationalCredential` (`credentialCategory: "license"`, `validUntil`, `recognizedBy`) and `worksFor` → firm. Firm: `RealEstateAgent`. All pages: `BreadcrumbList`. Public fields only. |
| OG images                                                                | `opengraph-image.tsx` with `ImageResponse`: brand card for static pages; for practitioner and verify pages, name, category and status on a branded card. **No photo** unless the photo-on-register flag is on.                                                                                                                                                                                                                                                         |
| Manifest and icons                                                       | `app/manifest.ts` (name, short name, theme colours, maskable icons 192 and 512), `apple-icon.png`, plus the existing `icon.svg`.                                                                                                                                                                                                                                                                                                                                       |
| Core Web Vitals                                                          | See the §5.4 budget. Public pages are Server Components with near-zero client JS.                                                                                                                                                                                                                                                                                                                                                                                      |
| Content                                                                  | Plain-language FAQ blocks with `FAQPage` JSON-LD on `/categories` (e.g. "What is an FSLA?"). These target real search queries.                                                                                                                                                                                                                                                                                                                                         |
| Tension with anti-scraping                                               | SEO pages are per entity and linked from search. Bulk listing endpoints stay rate-limited and `noindex` beyond page 1 of search. Record this trade-off in ADR-010.                                                                                                                                                                                                                                                                                                     |

### 7.6 Locale routing decision (ADR-010)

Today, locale is chosen by cookie (ADR-008), so **one URL serves three languages**. Search engines then index only one language, and hreflang is impossible.

**Recommendation:**

- Use next-intl locale-prefix routing **for public routes only**, with `localePrefix: "as-needed"`: `/register` (en), `/rw/register`, `/fr/register`.
- Authenticated areas keep cookie-based locale, which they don't need indexed.
- The language switcher on public pages navigates to the equivalent localised URL.

### 7.7 Acceptance

- [ ] Lighthouse SEO is 100 and Accessibility is 100 on `/`, `/register`, `/check/[n]`, `/categories` and `/eligibility`.
- [ ] Rich Results Test passes for the JSON-LD.
- [ ] Each public page is reachable at three locale URLs with reciprocal hreflang.
- [ ] `/check/[n]` LCP ≤ 1.5 s on Fast 3G, with 0 KB of page-specific client JS.

---

## 8. Phase P4 — Authentication and onboarding

**Goal:** fewer screens, less typing, and no accessibility traps.
**Effort:** about 2–3 dev-days.

- **Sign-up:**
  - Split into short steps: Account type (two big cards: Individual / Firm) → Name, email and phone → Password (strength meter as a `Meter`).
  - Verification codes for email and phone appear as inline `OtpInput`s with a countdown ring for resend (`useCountdown`).
- **OTP:** `autocomplete="one-time-code"`, Web OTP API on Android Chrome (`navigator.credentials.get({ otp })`) for SMS autofill, and paste support. No CAPTCHA that requires transcription (WCAG 2.2 **3.3.8**).
- **Passwords:**
  - Allow paste.
  - Set `autocomplete="new-password"` and `"current-password"`.
  - Show/hide control (already there).
  - Show the breached-password check (FR-ACC-004) as a friendly inline message.
- **Passkeys (FR-ACC-005, Should):**
  - Design the "Use a passkey" button and enrolment card now, behind a feature flag.
  - Android, at about 78% of users, supports passkeys via Google Password Manager. This becomes the fastest login for returning users.
- **Two-step page:** a `Segmented` control to switch method (App code / SMS / Recovery code) instead of links.
- **Auth layout:**
  - Keep the brand panel on `lg` and replace the bullet list with the animated licence-card illustration.
  - On mobile, show a compact brand header and keep the form above the fold.
- **First-run onboarding** (UX-013):
  - Three swipeable cards (Apply → Track → Verify) with illustrations, skippable and shown once.
  - Then a **setup checklist card** on the dashboard (Verify phone ✓, Turn on 2-step, Complete profile), which disappears when complete.

**Acceptance:** sign-up to verified dashboard in ≤ 2 minutes in a usability test; axe clean; OTP autofill works on a real Android device.

---

## 9. Phase P5 — Applicant workflows

**Goal:** turn the SRS screens 3–8 (§11.3) into visual, low-text flows.
**Effort:** about 8–10 dev-days, alongside the domain work packages.

### 9.1 Dashboard (FR-PORTAL-001, 004)

Order is by priority on mobile, and the page becomes a bento grid on desktop.

1. **Smart action cards:** a horizontal swipe carousel (scroll-snap, dots, swipe or arrow keys).
   - One card per required action: "Licence expires in 45 days", "Supervisor hasn't confirmed", "Pay RWF 25,000".
   - Each card has an icon, a one-line title, the key number and **one** button.
   - The tone comes from `status-tones`.
2. **Licence card:** a wallet-style card in the brand gradient showing:
   - category and licence number (`CopyField`);
   - a `ValidityRing` with days left;
   - a QR thumbnail that taps to the full-screen QR, with **brightness hint**, for showing clients in the field.
3. **Applications in progress:** cards with a `ProgressRing` (completion %), a `StateJourney` and the next action. An empty state offers "Start your first application" alongside the eligibility result if one exists.
4. **Upgrade path:** a `CategoryLadder` mini-view, e.g. "Eligible for Broker from 12 Mar 2027" (persona Eric).
5. **Activity:** the last 5 events (FR-AUD-005) as a compact timeline.

### 9.2 Application wizard (FR-WIZ-001…014, UX-004)

- **Entry:** a **task-list overview** (GOV.UK) showing every applicable section with a status chip and an overall `ProgressRing`. The task list is the "home" of a draft.
- **Section pages:**
  - One topic per page, a sticky top progress header ("Education · 3 of 9", thin progress bar) and a **sticky bottom action bar** with Continue as the primary action.
  - "Save & exit" sits in the top bar as text, and a "Saved ✓" pill appears after each autosave (FR-WIZ-004, debounced ≤ 2 s).
- **Help:** an ⓘ in each step header opens a help sheet ("Why do we ask this? Article 12…", FR-WIZ-012). Step pages keep at most one line of intro text.
- **Live eligibility:** an inline `Meter` card updates as dates are entered ("2 y 7 m / 3 y needed") with a non-blocking tone (FR-WIZ-007).
- **Repeatables** (qualifications, experience): summary cards with Edit and Remove, and "Add another" opens a `ResponsiveDialog`. Pre-fill comes from the profile, with a "Pre-filled" chip the user can review (FR-ACC-009, WCAG 3.3.7).
- **Category change warning** (FR-WIZ-009): a confirmation sheet that lists the affected sections as chips.
- **Documents step:** a `ChecklistGrid` of required document tiles. Tapping a tile opens `FileDrop` with camera capture, live upload progress ring and scan status (Scanning → Clean ✓ / Rejected ✕). Errors follow UX-005 ("Photo must be 600×600 px; yours is 400×400. Take a new photo.").
- **Check answers:** a `SummaryList` per section with Change links that return straight to the check-answers page (FR-WIZ-008).
- **Declaration:** **verbatim legal text**, unchanged, plus a plain-language summary in a collapsible panel. Consent checkboxes are not pre-ticked and are each purpose-specific (Law 058/2021).
- **Offline tolerance** (FR-WIZ-011): an "Offline · changes saved on this device" banner and a sync indicator. The implementation is in P7.

### 9.3 Payment (Section K)

- A fee breakdown card (RWF, no decimals, `Intl.NumberFormat`), then a choice of method as large cards: **MTN MoMo**, **Airtel Money**, Card.
- **Mobile-money flow:**
  1. Confirm the phone number (pre-filled, `+250`).
  2. "Check your phone and enter your PIN" screen with an animated phone illustration and a **countdown ring**.
  3. Poll for status, with webhooks as the source of truth.
  4. Handle long-pending and timeout states without double-charging: a "Still waiting? Check again / Try another method" sheet.

  Verify the timeout and status semantics against the MTN and Airtel developer documentation.

- **Back after payment:** pressing Back shows a "You've already paid — view receipt" message and never re-triggers payment (GOV.UK guidance).

### 9.4 Confirmation and tracking (FR-WIZ-014, FR-PORTAL-002/003)

- **Confirmation page:**
  - A success hero: an animated check-draw at `--dur-4` with `--ease-spring`, and a short Sun-coloured confetti burst, skipped under reduced motion.
  - The **reference number** in a large `CopyField`, plus "What happens next" as a three-node mini-timeline.
  - Download acknowledgement (PDF) and share buttons.
- **Application detail:**
  - `StatusTimeline` with SLA expectations.
  - Tabs (Segmented on mobile): Timeline · Documents · Messages · Receipts.
  - Information requests appear as a highlighted action card that unlocks only the named fields (FR-WF-002).

### 9.5 Licence wallet (screen 6, FR-N-008/010)

- A wallet-pass-style card with a flip interaction: front shows identity and status, back shows the conditions summary. Flip uses a 3D transform; reduced motion gets a cross-fade.
- A **full-screen QR mode**: maximum contrast, no theme tint, and a "Keep screen on" Wake Lock (where supported).
- Buttons for "Download certificate (PDF)" and "Add to Google Wallet" (Should, FR-N-010; Android majority makes Google Wallet the priority).
- Conditions and obligations as icon rows, with the full text in a sheet.

### 9.6 Confirmation inbox and firm workspace (screens 7–8, FR-FIRM-002/003)

- **Inbox:**
  - Request cards with applicant, category and what is being confirmed. **Swipe right to confirm, left to decline**, with visible buttons as the single-pointer alternative (WCAG 2.5.7).
  - Bulk select mode (long-press or checkbox) with a sticky bulk-action bar, for persona Grace.
  - Decline asks for a reason.
- **Roster:**
  - Header stats: `StatTile`s for active, expiring in 60 days, and supervisees per supervisor (a `Meter` against the ratio limit).
  - A `DistributionBar` by category.
  - A searchable list with status badges and CSV/PDF export.

### 9.7 Acceptance

- [ ] An FSLA happy path on a Pixel 7 profile completes without horizontal scroll, with every step under 1 screen of intro text.
- [ ] NFR-USE-001: median ≤ 25 minutes in usability testing.
- [ ] Autosave, offline banner and payment-pending states are covered by E2E tests (network emulation).

---

## 10. Phase P6 — Back office (screens 9–16)

**Goal:** dense, fast and keyboard-first for Officer Jean, while still usable on a tablet. The applicant motion language is toned down here: transitions are ≤ 160 ms and there is no decorative animation.
**Effort:** about 8–10 dev-days, alongside WP-3.x and WP-4.x.

- **Overview:**
  - Replace the "planned for D4" cards (**A9**) with a role-aware **KPI row** of `StatTile`s with sparklines: my queue, due today, SLA at risk, decided this week.
  - A "Next up" card that opens the oldest at-risk file.
- **Work queue** (FR-BO-001…005):
  - A data table with sticky header, column density toggle, saved views as chips, multi-select bulk actions, and an **SLA cell** (a small bar showing time used against the SLA, coloured by status tone with an icon).
  - On mobile, the table becomes cards.
  - Keyboard: `J`/`K` move, `Enter` opens, `A` assigns.
- **Review console** (FR-L-001…013, UX-012):
  - Resizable **split view**: data on the left, document viewer on the right (zoom, rotate, page thumbnails).
  - The verification checklist is a vertical list of items with **one-tap Verified / Failed / N/A** segmented buttons, auto-evidence chips and notes.
  - Keyboard: `V` verify, `F` fail, `N` next document, `?` shortcut sheet.
  - On tablet the panes become tabs. A progress ring shows how many checks are done.
- **Decision console** (FR-M):
  - A summary card with the recommendation and the officer's reasoning, a conditions picker (chips with search) and re-authentication through `StepUpProvider`.
  - Batch approval is a stepper that **forces viewing each summary** before signing (FR-M-016).
- **Reports and analytics** (FR-RPT-001…003):
  - shadcn charts (Recharts), dynamically imported. Each chart follows the dataviz method: one y-axis, fixed categorical order, crosshair tooltip, legend for 2+ series, "View as table" toggle, and a single filter row (date range + dimension) above the charts.
  - Suggested set:

    | Chart                  | Measure                                   |
    | ---------------------- | ----------------------------------------- |
    | Line                   | Applications per week by status group     |
    | Bar                    | SLA compliance by stage                   |
    | Funnel                 | Draft → Submitted → Decided (FR-RPT-004)  |
    | Horizontal bar         | Practitioners by category                 |
    | Choropleth or tile map | District counts (sequential emerald ramp) |
    | Stacked bar            | Fees by method                            |

- **Audit console:** a filterable timeline view with diff chips. Masked PII stays masked (`maskEmail` / `maskPhone`).

**Acceptance:** an officer completes a review using only the keyboard; the queue renders 500 rows with virtualisation at INP < 200 ms; charts pass the dataviz anti-pattern checklist and have table views.

---

## 11. Phase P7 — Polish, PWA and performance

**Effort:** about 4–5 dev-days.

- **PWA (UX-015):**
  - A service worker (Serwist or a hand-written worker; choose in an ADR, respecting `minimumReleaseAge`).
  - Caching: precache the shell; stale-while-revalidate for the dashboard; network-first for data.
  - An **IndexedDB draft queue** with background sync on reconnect and conflict notification (FR-WIZ-011).
  - An install prompt shown **after** a successful action (e.g. after submission), never on first visit.
- **Motion polish pass:**
  - Audit every interaction against §4.5.
  - Add a press state to all cards that act as links, skeleton → content cross-fades, and list stagger on first load only.
- **Microinteractions:**
  - Copy ✓ morph, a toggle thumb spring, and a checkbox tick draw.
  - Pull-to-refresh is **not** added (the browser already does it).
  - Haptics via `navigator.vibrate(10)` on Android for success and error, only when the user hasn't turned on reduced motion.
- **Performance hardening:**
  - Route-level code splitting check, `next/dynamic` for all sheets with heavy content, and image audit.
  - Font `size-adjust` fallbacks to remove CLS.
  - RUM web-vitals reporting to observability, with no PII.
- **Low-data mode:** honour `navigator.connection.saveData` and `prefers-reduced-data` (where supported) by disabling decorative patterns, count-ups and OG-style imagery.

**Acceptance:** Lighthouse PWA installable; offline draft edit then reconnect syncs in E2E; the bundle budget holds in CI.

---

## 12. Phase P8 — Verification and international standards (continuous; gates release)

| Standard                              | What we verify                                                                                                                                                                                                                                                        | How                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WCAG 2.2 AA** (SRS R6, NFR-USE-002) | All of 2.2, especially 2.4.11 Focus Not Obscured, 2.5.7 Dragging, 2.5.8 Target Size (≥ 24 px, our standard 44 px), 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication ([W3C](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)) | axe in Playwright for every page, both themes, at 360 and 1280 px; a manual audit with TalkBack, VoiceOver and NVDA; keyboard-only run-through                               |
| **Contrast**                          | Token pairs, status badges, chart marks (≥ 3:1)                                                                                                                                                                                                                       | the token contrast unit test (P0) plus the dataviz validator                                                                                                                 |
| **Reduced motion and forced colours** | No movement under `prefers-reduced-motion`; usable under Windows High Contrast (`forced-colors: active`)                                                                                                                                                              | Playwright `emulateMedia` snapshots                                                                                                                                          |
| **i18n**                              | No hard-coded strings; layouts survive long text; Kinyarwanda word wrapping                                                                                                                                                                                           | ESLint literal rule; a **pseudo-locale** (`xx`, +40% length with accented characters) run in E2E screenshots; `Intl` formats for dates (DD/MM/YYYY, UX-014), numbers and RWF |
| **Privacy UX (Law 058/2021)**         | Purpose-specific, un-ticked consent; a withdraw-consent control in settings; a "What's public about me" preview showing exactly the FR-REG-003 fields; privacy notice in 3 languages                                                                                  | review with the DPO; verify the legal points against the Gazette text and NCSA guidance                                                                                      |
| **Usability (UX-016)**                | ≥ 5 users per key persona, SUS ≥ 75, FSLA ≤ 25 min                                                                                                                                                                                                                    | moderated sessions, in Kigali and outside it, on participants' own phones                                                                                                    |
| **Performance**                       | §5.4 budgets                                                                                                                                                                                                                                                          | Lighthouse CI on each PR; RUM after launch                                                                                                                                   |

---

## 13. Delivery

### 13.1 Suggested sequencing (one front-end engineer plus one designer; parallelises well)

```
Week 1   P0 tokens + ADRs ─► P1 primitives (part 1) ─► /dev/design style guide
Week 2   P1 data-viz components ─► P2 shell (bottom nav, sheets, transitions)
Week 3   P3 public pages + SEO  ║  P4 auth & onboarding
Week 4+  P5 applicant flows     ║  P6 back office      (follow the domain WPs)
Then     P7 PWA & polish ─► P8 audits & usability tests ─► release gate
```

P8 checks (axe, contrast tests, budgets) are added to CI in P0 and grow with each phase.

### 13.2 New dependencies (each needs review against `minimumReleaseAge`)

| Package                                         | Why                                             | Where it loads                             |
| ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `cmdk`                                          | Command palette, comboboxes                     | lazy (palette and combobox only)           |
| `recharts`, via the shadcn chart wrapper        | Back-office analytics                           | `/backoffice/reports` only, `next/dynamic` |
| `@tanstack/react-virtual`                       | Queue and register virtualisation               | back office and register                   |
| `size-limit`, `@lhci/cli` (dev)                 | Budgets in CI                                   | CI                                         |
| _(deferred to P7)_ `motion`                     | Only if physics-based sheet gestures are needed | `LazyMotion` + `m`                         |
| _(P7, ADR)_ Serwist, or a custom service worker | PWA                                             | —                                          |

No new dependency is added for icons (keep `lucide-react`), toasts (keep `sonner`) or themes (keep `next-themes`).

### 13.3 Definition of done (every UI pull request)

- [ ] Built from P1 components and tokens only, with no raw colours or one-off motion values.
- [ ] Strings in `messages/en.json` (rw and fr keys added as drafts). No hard-coded `aria-*`.
- [ ] Works at 320, 360, 768, 1280 and 2560 px. Mobile is checked first.
- [ ] Light and dark screenshots attached to the PR. axe is clean in both.
- [ ] Reduced-motion behaviour checked.
- [ ] Every chart or graphic has a text alternative or table.
- [ ] Bundle budget passes. No new client component where a Server Component works.
- [ ] Commit messages cite SRS or UX IDs (e.g. `feat(ui): UX-007 FileDrop with camera capture`).

### 13.4 Open questions for the Professional Body and the product owner

1. **Brand identity:** which body is the regulator (NLA / RWAREB / other), and when do approved logo and colour assets arrive (P8 / D-004)? This plan's palette is designed to be replaced by tokens.
2. Are practitioner register pages **indexable by default** or opt-in (FR-REG-008 vs privacy)? This decides the sitemap scope.
3. Does the regulator want a **photo** on public verification pages (FR-REG-003 default: off)?
4. Which mobile-money aggregator or gateway (direct MTN/Airtel APIs vs IremboPay)? This decides the payment-pending UX details.
5. Kinyarwanda translations: who approves UI copy (not only legal text), and on what turnaround?

---

## Appendix A — Research sources

- GOV.UK Design System: [question pages](https://design-system.service.gov.uk/patterns/question-pages/), [check answers](https://design-system.service.gov.uk/patterns/check-answers), [task list](https://designnotes.blog.gov.uk/2017/04/04/weve-published-the-task-list-pattern)
- W3C, [What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- Next.js, [View transitions guide](https://nextjs.org/docs/app/guides/view-transitions)
- Material Design: [dark theme](https://m2.material.io/design/color/dark-theme); M3 motion tokens (third-party ports; confirm on m3.material.io)
- StatCounter: [mobile OS share, Rwanda](https://gs.statcounter.com/os-market-share/mobile/rwanda), [Android versions](https://gs.statcounter.com/android-version-market-share/mobile/rwanda)
- [DataReportal, Digital 2026: Rwanda](https://datareportal.com/reports/digital-2026-rwanda) · [TechCabal on data prices](https://techcabal.com/2025/06/12/rwanda-internet-penetration-rate/)
- [Cenfri, digitisation of government services in Rwanda](https://cenfri.org/articles/digitisation-of-government-services-in-rwanda-lessons-from-the-data/) · [IremboPay](https://irembo.com/irembopay/)
- Flag colours: [FOTW](https://crwflags.com/fotw/flags/rw.html) (Pantone references; no official hex exists)
- Regulation context: [New Times, new rules for real estate brokers](https://www.newtimes.co.rw/article/37540/news/housing/new-rules-to-regulate-real-estate-brokers) · [first regulator in the offing](https://www.newtimes.co.rw/article/39290/news/housing/first-regulator-for-real-estate-professionals-in-the-offing)
- Data protection: [dataprotection.africa, Rwanda](https://dataprotection.africa/rwanda/), [DLA Piper](https://www.dlapiperdataprotection.com/?c=RW&t=law) (secondary sources; verify against the Gazette text)
- Charts: [TanStack chart library comparison](https://tanstack.com/charts/latest/docs/comparison) · [Vercel acquires Tremor](https://vercel.com/blog/vercel-acquires-tremor)
- Motion: [motion.dev migration notes](https://motion.dev/docs/migration)

**Unverified items flagged in research:**

- M3 spring and token values and Motion bundle sizes come from third-party sources.
- The French text-expansion figure (+15–30%) is an industry heuristic.
- The breach-notification and data-localisation specifics of Law 058/2021 need checking against primary sources.
- No current median mobile-speed data for Rwanda was found, so design for 3G.

---

## Appendix B — Implementation status (2026-10-14, branch `feat/ui-modernization`)

| Phase | Delivered                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Waiting on                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P0    | Emerald/Sky/Sun tokens, "Ink" near-black dark theme, motion tokens, view-transition CSS, Figtree-only type, `scroll-padding` (2.4.11), `color-scheme`, theme colours. A1, A2, A3, A5, A10–A14 fixed. Token contrast test (63 pairs, both themes). ADR-009, ADR-010.                                                                                                                                                                                                       | Brand assets (D-004)                                                                                                       |
| P1    | `StatusBadge`, `IconButton`, `Segmented`, `Chip`, `CopyField`, bottom `Sheet`, skeleton presets, upgraded `Button`/`EmptyState`; data graphics `ProgressRing`, `ValidityRing`, `Meter`, `Sparkline`, `StatTile`, `StatusTimeline`, `StateJourney`, `DistributionBar`, `ColumnChart`, `BarList`; `CountUp`, `Reveal`, `PageTransition`; `CategoryLadder`, `LicenceCard`; status tones and eligibility pre-check in `@rebp/contracts`; living style guide at `/dev/design`. | `DateInput`, `PhoneInput`, `AddressCascade`, `Combobox`, `FileDrop`, `ErrorSummary` ship with the wizard (no consumer yet) |
| P2    | Bottom tab bar + "More" sheet (< md), navigation rail (md–lg), sidebar (≥ lg), ⌘K command palette, route transitions, dismissible pilot banner.                                                                                                                                                                                                                                                                                                                           | Notification centre (needs in-app notification data)                                                                       |
| P3    | Search-first landing with sample licence card, interactive ladder, eligibility quiz, register search with URL filters, `/check` and `/check/[number]` (QR scan via `BarcodeDetector`), `robots`, `sitemap` with hreflang, manifest, OG image, icons, JSON-LD (WebSite, Organization, FAQPage), locale-prefixed public URLs.                                                                                                                                               | Register data (Section N); practitioner pages                                                                              |
| P4    | Brand auth panel with licence card, animated auth cards. Existing forms already met OTP autofill, paste and password-manager requirements.                                                                                                                                                                                                                                                                                                                                | Passkeys (FR-ACC-005)                                                                                                      |
| P5    | Dashboard from real data (setup ring, journey, licence slot, audit-based activity); visual applications and licence-wallet states.                                                                                                                                                                                                                                                                                                                                        | Wizard, payments, licences (WP-1.x–3.x)                                                                                    |
| P6    | Back-office overview with capability-gated live KPIs (accounts, sessions, two-step adoption, audit activity, people by role); milestone jargon removed (A9).                                                                                                                                                                                                                                                                                                              | Queue, review and decision consoles                                                                                        |
| P7    | Service worker (static cache-first, offline fallback page), install metadata, low-data CSS, lazy-loaded palette, ladder detail and QR scanner, `sideEffects: false` on contracts (keeps zod off public pages).                                                                                                                                                                                                                                                            | IndexedDB draft queue (with the wizard)                                                                                    |
| P8    | New E2E: axe on new pages in both themes, quiz flows, ladder, check page, filters, palette, hreflang, robots/sitemap/manifest, reduced motion, banner, phone tab bar and More sheet, no sideways scroll. 49/49 pass.                                                                                                                                                                                                                                                      | Manual screen-reader audit, usability tests, Lighthouse CI                                                                 |

**Measured landing-page JavaScript** (compressed, production build, Pixel 7 profile): `main` 239 KB → this branch 249 KB. The SRS budget (NFR-PERF-005, 200 KB) was already exceeded on `main`; the biggest shared chunks are react-dom (~71 KB), the Next runtime (~36 KB) and the message runtime (~21 KB). Bringing the route under budget is a follow-up (candidates: drop `@tanstack/react-query` and `sonner` from the public layout, slim the client message payload).
