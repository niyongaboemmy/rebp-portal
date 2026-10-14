# ADR-009 — Visual language: colour, type, motion and data graphics

**Status:** Proposed (implemented on `feat/ui-modernization`; awaiting tech-lead and design review) ·
**Amends:** ADR-008 · **Refs:** UX-001…017, NFR-PERF-005, WCAG 2.2 AA · **Plan:** [UI_MODERNIZATION_PLAN](../UI_MODERNIZATION_PLAN.md)

- **Palette.** Primary "Imena Emerald" `oklch(0.47 0.11 160)` (`#006d45`, 6.2:1 on the page), derived from the
  flag green. Sky `oklch(0.5 0.14 245)` for information, Sun `oklch(0.87 0.16 92)` for highlights (never as text
  on light surfaces). National colours inspire the palette only; no flag, coat of arms or agency marks until
  approved brand assets arrive (D-004). Every value is a token, so a brand swap is a one-file change.
- **Dark theme "Ink".** Near-black, cool-tinted background `oklch(0.165 0.01 258)` (`#0c0f13`), never `#000`.
  Elevation is lightness (card 0.198 → popover 0.232 → surface-3 0.265), not shadow, plus a 1 px top highlight.
- **Contrast is tested, not eyeballed.** `src/lib/__tests__/tokens.test.ts` parses `globals.css` and asserts
  every text pair ≥ 4.5:1 and every control boundary (`--input`, `--ring`) ≥ 3:1 in both themes.
- **Status tones** live in `@rebp/contracts` (`status.ts`): good / warning / critical / info / neutral. The UI
  always pairs a tone with an icon and a label (`StatusBadge`, `TONE_ICONS`); tones are never chart series.
- **Charts.** Categorical slots `--chart-1…8` use the validated dataviz reference order, in fixed order, never
  cycled. Validator (2026-10-14): light on `#ffffff` passes all gates (worst adjacent CVD ΔE 9.1; three slots
  below 3:1 contrast → visible value labels and an sr-only table are mandatory, which `DistributionBar`
  provides); dark on `#12161b` passes all gates (CVD ΔE 8.4, all ≥ 3:1). Applicant-side graphics are hand-rolled
  SVG (`components/data/*`, no chart library); a library is only considered for back-office analytics.
- **Typography.** One variable family, Figtree (headings 650–800, −0.02 em), plus JetBrains Mono for codes;
  Bricolage Grotesque is dropped (one fewer font download). Tabular numerals via the `num` utility.
- **Motion.** CSS-first. Tokens `--ease-standard|enter|exit|spring`, `--dur-1…5` (100–600 ms). Only
  `transform`, `opacity` and SVG stroke offsets animate. Route transitions use React `<ViewTransition>` from each
  route group's `template.tsx`; header, rail and tab bar are pinned. Reduced motion keeps short fades and removes
  movement, count-ups and pulses. No animation library is added.

## Amendment v2 (2026-10-14) — navy primary

- **Primary becomes the client's navy `#010080`** (`oklch(0.272 0.188 264.4)`, white text ≥ 15:1), replacing
  Emerald. Reason: the client's brand, and green had doubled as the "success" status hue, so brand and state
  were indistinguishable (gap B-01). Green is now reserved for success.
- **Dark mode** uses a periwinkle of the same hue, `oklch(0.75 0.13 270)`, with dark text; navy on near-black
  would be invisible. `--brand` keeps the true navy in both themes for white chips on brand surfaces.
- **Neutrals and background** move to hue 265 (cool, blue-tinted); the dark "Ink" surfaces keep their lightness
  steps at hue 268.
- **Brand surface** (`bg-brand`): navy lit by royal blue `oklch(0.42 0.2 262)` and indigo
  `oklch(0.24 0.14 285)`; a test asserts white text ≥ 7:1 on every stop.
- **Primary buttons** get `btn-gloss`: a soft top highlight and a navy-tinted shadow.
- Icons, Open Graph card, PWA icons, manifest and `theme-color` are re-coloured to match.

## Amendment v3 (2026-10-14) — royal blue, flat surfaces, physical motion

- **Primary is a vivid royal blue from the brand hue**: `oklch(0.52 0.23 264)` light and `oklch(0.56 0.21 263)`
  dark. Buttons stay blue with white text in both themes (≥ 4.7:1); fills keep ≥ 3:1 against the page. The navy
  `#010080` is kept as **brand ink** (`--brand`): logo and brand surfaces. Reason: navy read as too dark for
  interactive elements on light backgrounds.
- **`--link`** is primary used as text: the same blue in light mode, periwinkle `oklch(0.74 0.14 266)` in dark
  mode. A blue that can carry white text is too dim to read as text on near-black. All `text-primary` usages
  became `text-link`.
- **Flat design.** Surfaces separate by hairline borders and tone, not shadows. Decorative borders are alpha
  hairlines (9% light, 8% dark) that blend with any surface. Form-field borders stay ≥ 3:1 (WCAG 1.4.11), the
  one place a border must be visible. Shadows are reserved for real overlays: menus, dialogs, sheets, tooltips.
- **Physical, minimal button motion** (no shadows):
  - press compresses to 97% and springs back on release (`--ease-spring`)
  - a ripple spreads from the touch point (`<Interactions />`, one delegated listener)
  - the fill deepens on hover
  - a trailing arrow nudges forward
  - all off under reduced motion
- **Button hierarchy:**
  - `default`: the one main action per view
  - `outline`: secondary actions and equal alternatives, e.g. "Sign in" next to "Create account", "Am I
    eligible?" next to "Start", "Set up" when several methods are offered, Share, error-page second routes
  - `tonal`: supportive actions inside cards
  - `ghost`: tertiary and icon actions
  - `link`: inline navigation
- **Secondary colours have one job each:**
  - **Sun** (yellow) for highlights and delight: step numerals, sketch underlines, the "Best fit" marker, the
    logo dot.
  - **Ember** (orange) for time and "what's next" cues that are _not_ a status: coming-soon chips, the
    mobile-money countdown, "Next" category, experience progress towards the next category.
  - Neither replaces the status colours (warning, critical), which always carry an icon.
