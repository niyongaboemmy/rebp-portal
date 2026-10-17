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

## Amendment v4 (2026-10-14): borderless surfaces and the landing header

- **Borderless by default.** `* { border-color: transparent }`. Block elements separate by tone (`bg-surface-*`,
  `bg-sunken`), never by a line. Only form fields opt in, with `border-input`.
- **Input hairline (accepted trade-off).** Field borders are the lowest-opacity hairline (16% light, 14% dark),
  below the WCAG 1.4.11 3:1 non-text contrast. Fields stay identifiable through a tinted fill, a label and a
  placeholder. The hover border strengthens, and the focus border and ring stay ≥ 3:1.
- **Header (UX-001):**
  - Transparent over the full-height landing hero, then frosted with a small shadow once scrolled.
  - Labels never wrap. Links that don't fit fold into a "⋯" menu; widths are measured live, per locale.
  - Search is an icon.
  - Language is a dropdown.
  - The theme switch is one tap.
  - Signed-out visitors get one account button with a Sign in / Create account menu.
  - Below md, the links move into the drawer.
- **Hero:**
  - Minimal copy: a title of about four words and a one-line subtitle.
  - No floating background decoration.
  - The only motion is the licence card:
    - it flips in, then drifts in 3D like a card held in the hand
    - a sheen crosses its laminate, and a glare follows the pointer
    - a contact shadow softens as the card lifts
    - status chips pop in one after another
  - The card is still under reduced motion.
- **Themes.** `meta[name=theme-color]` follows the resolved theme. Every colour token has a dark value (a test
  enforces this).

## Amendment v5 (2026-10-17) — Phosphor icons

- **Phosphor replaces Fluent** as the app's icon family (MIT, 9,072 assets).
  - **Why:** a review drew seven candidates in the portal's own sidebar: Phosphor, Hugeicons, Material Symbols, Lucide, Tabler, Solar and Fluent. Fluent's 1 px Regular line read faint at 20 px. Phosphor reads as one hand, sits well next to Figtree, and is the only open family with six true weights of every glyph.
  - **Compared against:** Hugeicons (its fills are paid), Material Symbols (reads as Google), Lucide (the shadcn default, so products look alike) and Solar (CC BY, attribution required).
- **Weights and their roles.**
  - Regular, at a medium weight in navigation (`icon-medium`): idle UI and navigation, all outline.
  - The same outline in brand blue on the selection pill: the current page.
  - Fill (`filled`): toggled controls.
  - Duotone (`duotone`, the current colour at 20 %): empty states and feature tiles.
- **Mechanics.**
  - `scripts/icon-map.mjs` maps the app's names (lucide-style, unchanged call sites) to Phosphor names by meaning. `scripts/gen-icons.mjs` copies the path data from `@phosphor-icons/core` into `src/components/icons/phosphor.ts`.
  - The icons remain plain SVG: no runtime package, Server-Component safe.
  - `@fluentui/react-icons` is removed.

## Amendment v6 (2026-10-17) — Hugeicons Stroke Rounded (supersedes v5)

- **What the user asked for:** smooth, modern icons with rounded edges, all outline.
- **Why Phosphor fell short:** Phosphor's corners are geometric, and the extra stroke thickening read too heavy.
- **The choice:** Hugeicons "Stroke Rounded" (MIT, 6,091 icons; the comparison's runner-up). It is a 1.5 px line on a 24 px grid with generously rounded corners, joins and caps.
- **One style everywhere:**
  - Outline only. The current page is the same outline in brand blue on the selection pill.
  - `filled` and `duotone` remain accepted props but draw the rounded outline. The free set has no fills, and the product is outline-only by choice.
  - The nav icons are no longer thickened; `icon-medium` is removed.
- **Mechanics:**
  - `scripts/icon-map.mjs` maps the app's names to Hugeicons names by meaning. `scripts/gen-icons.mjs` copies each glyph's SVG body from `@iconify-json/hugeicons` 1.2.35 into `src/components/icons/hugeicons.ts`.
  - The generator allow-lists drawing elements and presentation attributes and fails on anything else, so the build-time markup is safe to inline.
  - `@phosphor-icons/core` is removed.

## Amendment v7 (2026-10-17) — Lucide light (supersedes v5 and v6)

- **Why it changed:** Hugeicons' rounded glyphs are closed, dense shapes, and they still read as solid in the menu even at 1 px.
- **How we chose:** six light options were compared in the portal's own light and dark menus (`menu-icon-options`). The user picked Lucide at a light stroke: simple, open shapes with round caps and joins (ISC, `@iconify-json/lucide` 1.2.138).
- **Line weight is a token, not baked into glyphs.** `--icon-stroke`, in `shell.css`, overrides each glyph's drawn width. CSS beats the presentation attribute.
  - 1.5 by default, for page content and the top bar.
  - 1.25 in menus: the sidebar and its sheet, the phone tab bar, the More sheet and dropdown menus. On the 24 grid that's about 1.05 px at 20 px.
  - An icon's `strokeWidth` prop sets the token for that icon alone.
- **Sources for the weights:** IBM (1.5 at 24 px, 1.25 at 20 px), GitHub Primer (1.5 at 16–24 px), and the irradiation effect (light lines read bolder on dark), which favours the lighter menu line.
- **Outline only.** `filled` and `duotone` remain accepted props and draw the outline. `@iconify-json/hugeicons` is removed.

## Amendment v8 (2026-10-17) — Fluent restored; Lucide light only in the side navigation (supersedes v5–v7)

Product feedback: keep Microsoft Fluent UI System Icons across the app (as at v4), and keep the light Lucide outlines
only in the side navigation, where the airy line weight was what we wanted.

- **App-wide:** `@/components/icons` exports Fluent (`fluent.ts`, generated by `scripts/gen-fluent-icons.mjs` from
  `scripts/fluent-icon-map.mjs`; `@fluentui/react-icons` 2.0.341 is a dev dependency, used only at build time).
  `filled` again marks active and selected states.
- **Side navigation:** the `PORTAL_NAV`, `BACKOFFICE_NAV` and `AREA_HOME` icons, plus the area-switcher and
  account-card chevrons, come from `@/components/icons/nav` (`nav.ts`, generated by `scripts/gen-nav-icons.mjs`
  from `scripts/nav-icon-map.mjs`, `@iconify-json/lucide`). They are drawn at `--icon-stroke: 1.25` (shell.css).
  Because these items also feed the mobile bottom bar, the More sheet and the command palette, those surfaces show
  the same nav glyphs. The sidebar toggle in the top bar stays Fluent.
- Both sets share `IconProps`, so navigation config can mix them. `pnpm --filter @rebp/web icons` regenerates both.

## Amendment v9 (2026-10-17) — flat overlays in both themes

Product feedback: in dark mode the menus (area switcher, account and help menus) read as heavy slabs. The causes were a
popover tone far above the page (`0.232` vs `0.165` L), bevelled inset highlights, a near-black drop shadow and
bubble-like icon tiles.

- **One overlay recipe:** `bg-popover` plus `shadow-(--overlay)`, a 1 px hairline edge and one soft, low drop.
  `--overlay-drop` is the drop alone, for surfaces that already have a border edge (sheets). There's no glass, no
  bevel and no translucency. This covers DropdownMenu (and therefore every menu, select and searchable menu),
  submenus, dialogs (including the command palette), sheets and the mobile bottom bar.
- **Dark `--popover`** is now `oklch(0.196 0.016 268)`, close to `--card`, so overlays sit in the page.
- **Menu icon tiles** use a primary tint (`dark:bg-primary/[0.14]`) with no inset highlight.
- **Tooltips and info tips** stay inverse in light mode. In dark they use the overlay surface instead of a white slab.

## Amendment v10 (2026-10-17) — Inter for UI, Plus Jakarta Sans for headings (supersedes the Figtree line)

Product feedback: Figtree read as soft and informal for a regulator's licensing service. Figtree's rounded geometry is
friendly, but at body sizes it lacks the crisp, institutional tone that dense forms, registers and back-office tables
need.

- **Inter** (variable, with the `opsz` axis) for UI and body text. It is the screen workhorse that product teams and
  public-sector design systems choose (education.gov.uk mandates it). It has a tall x-height, true tabular figures
  and broad Latin Extended coverage for French and Kinyarwanda. Features `cv05` (tailed l) and `cv08` (serifed I)
  keep I, l and 1 distinct in names and references.
- **Plus Jakarta Sans** (variable) for `h1–h4` and `font-display`. It adds warmth and character to headings and hero
  numbers without losing professionalism. It is already compact, so the heading tracking is −0.015 em (was −0.02)
  and tighter call-site values moved up one step: −0.035 to −0.025, −0.03 to −0.02, `tracking-tighter` to
  `tracking-tight`.
- **JetBrains Mono** is unchanged for codes.
- **Cost:** two variable families instead of one, both self-hosted and subset by `next/font`, with no runtime request.
- **Rejected:** Geist (reads as developer tooling), Public Sans (US-federal identity, plainer headings), and Inter
  alone (professional, but the headings lose character).

## Amendment v11 (2026-10-17) — Manrope, lighter weights (supersedes v10)

Product feedback on v10: Inter with Plus Jakarta Sans headings at 700–800 read as too solid. The product owner
compared four smooth candidates (Manrope, DM Sans, Outfit, Urbanist) in the same dashboard mock and chose Manrope.

- **Manrope** (variable, 200–800) is the one family for UI, body and headings: smooth open curves, an even stroke,
  tabular figures and Latin Extended. JetBrains Mono stays for codes. That makes one text family download again
  (v10 had two).
- **Lighter weights everywhere.** The Tailwind weight tokens are remapped in `@theme`:
  - `font-bold` is 650, `font-extrabold` 700 and `font-black` 750; `font-semibold` stays 600.
  - Base headings: h1 650, h2 650, h3 600 (were 750, 700 and 650).
- Heading tracking stays at −0.015 em, with call-site values as set in v10.

## Amendment v12 (2026-10-17) — Nunito (supersedes the Manrope choice in v11)

The product owner asked for a rounded, modern face. They compared Nunito, M PLUS Rounded 1c, Quicksand and Rubik in
the same dashboard mock and chose **Nunito** (variable, 200–1000, Latin Extended).

- Nunito has fully rounded stroke ends on a balanced skeleton: warm and modern, and still crisp in forms and tables.
- It is the one family for UI, body and headings. JetBrains Mono stays for codes.
- The lighter weight mapping from v11 stays (`font-bold` 650, `font-extrabold` 700, `font-black` 750; h1/h2 650, h3
  600), and so does the −0.015 em heading tracking.

## Amendment v13 (2026-10-17) — Fredoka headings with Nunito text (refines v12)

The product owner asked for more options and chose **Fredoka** (variable, 300–700) for `h1–h4` and `font-display`,
with **Nunito** kept for UI and body text.

- Fredoka's bubbly, fully rounded shapes give the brand a friendly, modern character where text is large.
- Heading weights are 600, 600 and 550 (h1, h2, h3), with tracking at 0.
- An unlayered rule in globals.css caps bold, extrabold and black at 600 on headings and display text. The same rule
  neutralises negative tracking utilities there, so call sites tuned for earlier faces don't render Fredoka heavy or
  with touching letters.

## Amendment v14 (2026-10-17) — Quicksand, light (supersedes v10–v13)

The product owner reviewed several rounds of candidates and found the professional grotesques too solid. From a set
of 12 light, elegant faces, with live weight controls, they chose **Quicksand** (variable, 300–700, Latin Extended)
at its default weights.

- **One family** for UI, body and headings, a rounded geometric with soft, airy strokes. JetBrains Mono stays for
  codes.
- **Weights:** text is 400 and headings (h1–h4 and `font-display`) are 500. The unlayered heading rule caps bold
  classes at 500 and sets negative tracking to 0. The Tailwind weight tokens are remapped: `font-bold` 600,
  `font-extrabold` 650, `font-black` 700.
- **Trade-off:** Quicksand's strokes are thin at small sizes. Contrast still comes from the colour tokens (tested in
  tokens.test). If small text reads faint on low-end screens in the pilot, raise body text to 500 before changing
  the face.

## Amendment v15 (2026-10-17) — Quicksand one step heavier

The product owner asked for a little more weight than v14.

- **Text** (body and `font-normal`) is 500, `font-medium` 600 and `font-semibold` 650.
- **Bold steps:** `font-bold`, `font-extrabold` and `font-black` are all 700, which is Quicksand's maximum.
- **Headings** (h1–h4 and `font-display`, including the unlayered cap) are 600.

## Amendment v16 (2026-10-17): back-office dashboard and status colour semantics (UX-040)

**Colour by meaning, used consistently in charts, rings, pills and badges:**

| Meaning                  | Colour                                            | Examples                                  |
| ------------------------ | ------------------------------------------------- | ----------------------------------------- |
| Waiting or queued        | Sun yellow (amber-yellow for "awaiting decision") | Counts, "Next", open files, due this week |
| In progress              | Primary blue                                      | Under review, submissions                 |
| Waiting on the applicant | Ember                                             | Action required                           |
| Done or good             | Success green                                     | Decided, on time, approved, two-step on   |
| Overdue or rejected      | Destructive red                                   | The only red on the page                  |

Text never relies on colour alone: every segment has a labelled legend with its count.

**Smooth, not solid.**

- Rings are 10 units thick on a soft track.
- The pipeline bar is a 32 % tint of each stage colour with a 3 px stage-colour baseline, not a solid slab. Counts sit
  in a card chip, so they meet 4.5:1 on any stage colour.
- Every tile is glass, with no heavy shadow.

**Overview v2**, at `app/(backoffice)/backoffice/page.tsx` with `components/dashboard/*`, is a bento of summary tiles.
Each opens a detail dialog.

| Tile            | What it shows                                                                                      | Detail                                              |
| --------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Command strip   | "Back office" h1, a waiting ring split by where items wait, the single next action and a Live pill | —                                                   |
| Four pulse KPIs | Count-up number, change against the previous week (green or amber by direction) and a sparkline    | Dialog with the full trend                          |
| Flow            | In against decided over 7, 14 or 30 days, with the net backlog chip                                | —                                                   |
| Pipeline        | A segmented bar and a row per stage with typical wait                                              | Count, share, wait and the oldest reference numbers |
| Deadlines       | Ring by due date                                                                                   | The most overdue reference numbers                  |
| Decisions       | Outcome mix over 30 days                                                                           | —                                                   |
| Security        | Two-step adoption, accounts, live sessions and new accounts                                        | Accounts by role                                    |
| Activity        | 30-day heat strip                                                                                  | —                                                   |
| Consoles        | Chips with Sun count bubbles                                                                       | —                                                   |

- **Charts** are hand-rolled SVG with HTML text. They have pointer and keyboard crosshairs and an sr-only data table,
  which sits inside an `sr-only` div because a table ignores `width: 1px` and would widen the page.
- **Live:** `router.refresh()` runs every 60 s while the tab is visible. The infinite ping animation is ignored by
  e2e `settle()`.
- **Data** comes from `server/backoffice/overview.ts` (`flowSeries`, `pipelineDetail`, `slaHealth`, `decisionMix`):
  aggregates and reference numbers only, gated by capability.

## Amendment v17 (2026-10-17): dashboard palette, blue-led, with yellow for awaiting (supersedes the v16 colour table)

Product feedback: green, orange and teal (`--sky`) don't belong to the brand's primary colours, the dashboard showed
too much yellow, and "awaiting is yellow".

- **Primary blue** is the dominant colour. Tints (22–100 %) carry work in hand, done and neutral states:
  - pipeline stages Submitted → Under review → Action required → Further assessment;
  - the flow chart, with In as a light blue and Decided as primary;
  - on track, approved, protected accounts, the Live dot, KPI trends and positive change chips.
- **Sun yellow** means awaiting, and is used sparingly:
  - the "Awaiting decision" pipeline stage;
  - the Decisions slice of the waiting ring;
  - the "decisions waiting for you" nudge;
  - items due within 2 days, "Next" and the count bubbles.
- **Destructive red** is only for overdue and rejected.
- **Not used on the dashboard:** `--success`, `--warning`, `--ember` and `--sky`.
- **Flat:** the pipeline bar is soft tints with no baseline borders; rings are thin, tiles are glass, with no shadows.
- **Guiding links:** every chart element is selectable. A selected ring segment shows its next step as a button, and
  the button is hidden when its count is 0. Destinations are exact filtered views (`DashLinks`, built on the server
  from capabilities):
  - queue by view, status, sort or reference number;
  - access control by `noMfa` or role;
  - the audit trail for a single day;
  - decisions, register, configuration and reports.
- **"Do now"** shows up to three prioritised nudges: overdue → due soon → decisions → backlog → applicants →
  two-step. Each is one fact and one action.
