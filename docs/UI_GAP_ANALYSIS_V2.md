# UI/UX Gap Analysis v2 — REBP Portal

| Item         | Value                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document ID  | REBP-PORTAL-UX-002                                                                                                                                                                                       |
| Date         | 2026-10-14                                                                                                                                                                                               |
| Baseline     | Commit `a1593d0` (UI modernisation v1, [UI_MODERNIZATION_PLAN](UI_MODERNIZATION_PLAN.md))                                                                                                                |
| Scope        | Every shipped screen: 20 routes × phone (Pixel 7) and desktop (1440 px), light and dark, anonymous, applicant and administrator                                                                          |
| Method       | Screenshot review against the heuristics below, plus automated measurement per page (axe with WCAG 2.2 and best-practice rules, touch-target sizes, word count, graphic count, overflow, console errors) |
| Brand change | Primary colour moves from Emerald to the client's **navy blue `#010080`** (`oklch(0.272 0.188 264)`)                                                                                                     |

**Benchmarks.** These are the services each part of the portal is measured against:

| Part of the portal         | Benchmark                           |
| -------------------------- | ----------------------------------- |
| Government transactions    | GOV.UK, Estonia e-Residency, Irembo |
| Mobile money and status UX | Revolut, Wise, M-Pesa               |
| Back office                | Stripe Dashboard, Linear            |
| Visual quality             | Apple (HIG) and Google (Material 3) |

---

## 1. Scorecard

Scores run from 1 (missing) to 5 (international best practice). "v2 target" is what this round delivers.

| Dimension                     | v1  | v2 target | Main reason for the gap                                                                      |
| ----------------------------- | --- | --------- | -------------------------------------------------------------------------------------------- |
| Brand and colour system       | 3   | 5         | Green primary is the same hue as "success", so brand and status blur. Client asked for navy. |
| Visual hierarchy and graphics | 4   | 5         | Audit trail, security and privacy pages are still text and tables                            |
| Interactivity of workflows    | 3   | 4.5       | Codes need manual submit, no live password feedback, no verify progress, raw audit log       |
| Minimal text                  | 3.5 | 4.5       | Privacy is a 90-word paragraph. The audit trail shows ~390 words of codes and hashes.        |
| Accessibility (WCAG 2.2 AA)   | 4   | 5         | 4 pages without `<h1>`, unfocusable scroll region, 36 px chips, broken heading order         |
| Internationalisation          | 2   | 4         | French 9% and Kinyarwanda 6% translated. **Language silently switches** while scrolling.     |
| Mobile ergonomics             | 4   | 5         | Filter chips and small text links under 44 px                                                |
| Performance                   | 3   | 3.5       | Landing JS 249 KB (budget 200 KB; 239 KB on `main`)                                          |
| SEO                           | 4.5 | 5         | Language-switch bug also corrupts crawled locale                                             |

---

## 2. Measurements (v1, English, phone)

| Page                         | Words in main | Graphics | Targets < 44 px             | axe findings                              |
| ---------------------------- | ------------- | -------- | --------------------------- | ----------------------------------------- |
| `/` landing                  | 153           | 37       | 6                           | region (moderate)                         |
| `/eligibility`               | 17            | 6        | 6                           | region                                    |
| `/register`                  | 43            | 4        | **19** (filter chips 36 px) | region                                    |
| `/check/[n]`                 | 23            | 4        | 6                           | region                                    |
| `/privacy`                   | 93            | **1**    | 6                           | region                                    |
| `/sign-up`                   | 89            | 5        | 8                           | —                                         |
| `/dashboard`                 | 54            | 14       | 2                           | region                                    |
| `/applications`, `/licenses` | 14–18         | 3–4      | 2                           | **page-has-heading-one**                  |
| `/settings/security`         | 126           | 7        | 8                           | **heading-order**                         |
| `/backoffice`                | 78            | 12       | 2                           | region                                    |
| `/backoffice/audit`          | **389**       | **1**    | 2                           | **scrollable-region-focusable (serious)** |
| 404, `/forbidden`            | 17–30         | 1        | 1–6                         | **page-has-heading-one**                  |

No horizontal overflow on any page at 360 px. No console errors except the expected 404.

---

## 3. Gaps

Severity: **Critical** = broken or misleading behaviour; **High** = failing a standard or a core workflow; **Medium** = clearly below benchmark; **Low** = polish.

### 3.1 Brand and colour

| ID   | Gap                                                                                                                                   | Evidence                                                    | Sev    | Fix (v2)                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| B-01 | Primary green equals the "success" hue, so a primary button and a "Verified" chip read the same. Brand colour carries status meaning. | Dashboard: green "Start" card next to green "Verified" rows | High   | Navy primary; green reserved for success only                                                                     |
| B-02 | Client brand colour not applied.                                                                                                      | Request: navy `#010080`                                     | High   | Navy scale: primary `oklch(0.272 0.188 264)` light; `oklch(0.74 0.13 268)` dark (navy is invisible on near-black) |
| B-03 | Flat primary buttons look generic next to Stripe, Linear or Revolut buttons.                                                          | All CTAs                                                    | Medium | Subtle top-lit gradient and inner highlight on primary fills; tonal secondary in navy tint                        |
| B-04 | Neutrals and light background are tinted green (hue 160), clashing with a blue brand.                                                 | `--background`                                              | Medium | Cool neutrals at hue 265; paper background `#f7f8fc`                                                              |
| B-05 | Brand surfaces (hero card, licence, auth panel) and generated assets (icons, OG card, manifest, theme-color) are green.               | `bg-brand`, `brand-image.tsx`                               | Medium | Navy-to-royal gradient surfaces; all assets re-coloured                                                           |

### 3.2 Internationalisation

| ID   | Gap                                                                                                                                                                                                                      | Evidence                                           | Sev          | Fix (v2)                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| I-01 | **The language changes by itself.** Next.js prefetches footer links (`/fr`, `/rw`). The proxy treats any prefixed request as a language choice and sets the cookie. Scroll to the footer and the next page is in French. | Audit run: every page after `/` rendered in French | **Critical** | Never set the cookie on prefetch requests; language links don't prefetch; E2E regression test                    |
| I-02 | French 9% and Kinyarwanda 6% translated, so non-English users see a half-English UI.                                                                                                                                     | Key coverage 72/787 (fr), 50/787 (rw)              | High         | Complete draft catalogues for both, flagged "draft" in the switcher as today, pending Professional Body approval |

### 3.3 Workflows and interactivity

| ID   | Workflow                | Gap                                                                                                                                                           | Sev    | Fix (v2)                                                                                                                                                                                            |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-01 | Sign-up                 | Password rules appear as one hint line; no live feedback that confirmation matches.                                                                           | Medium | Live checklist (length, match) with animated ticks                                                                                                                                                  |
| W-02 | Sign-up                 | Mobile field gives no `+250` cue; users don't know the expected format.                                                                                       | Medium | Country prefix adornment, numeric keypad                                                                                                                                                            |
| W-03 | Verify contacts         | Two independent cards, no overall progress.                                                                                                                   | Medium | "0 of 2 verified" progress ring in the header                                                                                                                                                       |
| W-04 | All code entry          | Pasting or SMS-autofilling a code still needs a "Verify" tap.                                                                                                 | Medium | Auto-submit on paste and Web OTP autofill. Typing still uses the button, so screen-reader users aren't surprised.                                                                                   |
| W-05 | Security settings       | 126 words before the first action; status is scattered across four cards; 36 px buttons.                                                                      | Medium | "Protection" ring with a checklist summarising verified email, phone, two-step and recovery codes; 44 px actions on phones                                                                          |
| W-06 | Audit trail             | Raw table: action codes (`auth.signin`), UUIDs, hashes; no filters, names, grouping or paging. Fails the "Officer Jean" persona and Stripe/Linear benchmarks. | High   | Human timeline grouped by day: icon, readable action, actor name, relative time. Category filter chips in the URL, 14-day activity chart, chain-integrity status, details on demand, "older" paging |
| W-07 | Privacy                 | 90-word paragraph, the only graphic is a warning icon.                                                                                                        | Medium | Five icon highlights (collect only what's needed, encrypted, need-to-know access, published fields, your rights), with the full text kept beneath                                                   |
| W-08 | Register                | Filter chips are 36 px on phones.                                                                                                                             | Medium | 44 px chips on phones                                                                                                                                                                               |
| W-09 | Errors (404, forbidden) | Plain icon tile, no `<h1>`, one way out.                                                                                                                      | Low    | Illustrated state with `<h1>` and a second action (search)                                                                                                                                          |

### 3.4 Accessibility (WCAG 2.2 AA)

| ID   | Gap                                            | Evidence                                        | Sev    | Fix (v2)                                                 |
| ---- | ---------------------------------------------- | ----------------------------------------------- | ------ | -------------------------------------------------------- |
| A-01 | Pages without a level-1 heading.               | `/applications`, `/licenses`, 404, `/forbidden` | High   | `EmptyState` takes a heading level; these pages use `h1` |
| A-02 | Scrollable table not keyboard-focusable.       | `/backoffice/audit` (serious)                   | High   | Table replaced by the timeline (W-06)                    |
| A-03 | Heading levels skip.                           | `/settings/security`                            | Medium | Correct hierarchy                                        |
| A-04 | Content outside landmarks (skip link, banner). | region rule, every page                         | Low    | Pilot banner becomes a labelled region                   |
| A-05 | Small standalone text links (24 px tall).      | "Forgot password?", "Create account"            | Low    | Padded to 44 px hit areas                                |

### 3.5 Performance (unchanged scope)

| ID   | Gap                                                                     | Sev    | Status                                   |
| ---- | ----------------------------------------------------------------------- | ------ | ---------------------------------------- |
| P-01 | Landing JS 249 KB versus a 200 KB budget; the overage exists on `main`. | Medium | Tracked; v2 adds no new client libraries |

---

## 4. Workflow interactivity review

For each journey: the number of steps, what the user sees, and what changes in v2.

| Journey                | Steps              | v1 experience                                            | v2                                       |
| ---------------------- | ------------------ | -------------------------------------------------------- | ---------------------------------------- |
| Am I eligible?         | 4–5 taps           | One question per screen, animated result, ladder markers | Unchanged (meets the benchmark)          |
| Verify a licence       | 1 search or 1 scan | Full-width status hero, time of check                    | Unchanged                                |
| Sign up                | 1 long form        | Static hints                                             | Live password checklist, `+250` cue      |
| Verify contacts        | 2 codes            | Two cards                                                | Progress ring; paste or autofill submits |
| Sign in with two steps | 2 screens          | Manual "Verify"                                          | Paste or autofill submits                |
| Dashboard              | —                  | Setup ring, journey, activity                            | Navy brand surface                       |
| Security               | 4 cards            | Text-first                                               | Protection ring and checklist up top     |
| Back office overview   | —                  | KPI tiles, charts                                        | Unchanged                                |
| Audit                  | Table              | Raw codes                                                | Filterable, human timeline with chart    |

---

## 5. Out of scope for v2

These are blocked by domain modules that don't exist yet: the application wizard, payments, the licence wallet and the review consoles. The v1 plan's Appendix B tracks them.

Approved translations are the Professional Body's to provide. v2 ships complete _draft_ catalogues so nothing renders half-English in the meantime.

## 6. Additions beyond the gap list (v2.1)

Requested in review: smoother motion and more modern, interactive graphics.

| Addition                | What it does                                                                                                                                            | Accessibility and motion safeguards                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero scene              | The licence card with three floating status chips ("Verified in 2 seconds", "Licence issued", languages), a scan beam over the QR, and pointer parallax | Chips are decorative (`aria-hidden`); parallax is transform-only, mouse/pen only, off under reduced motion                                                                                         |
| Journey diagram         | "How it works" becomes a tablist of four steps, each with an animated phone sketch (account, guided form, mobile-money PIN, licence QR)                 | Arrow/Home/End keys; plays **once**, with a visible pause/play control (WCAG 2.2.2); picking a step stops it; hover/focus pause; no autoplay under reduced motion; panel above the steps on phones |
| Sketch underline        | Hand-drawn Sun-yellow stroke that draws itself under display headings                                                                                   | Decorative                                                                                                                                                                                         |
| Cursor spotlight        | Soft navy glow follows the pointer across interactive cards (ladder, KPI tiles, quiz answers, consoles, trust items)                                    | One delegated rAF listener; hover devices only; off under reduced motion                                                                                                                           |
| Smooth anchor scrolling | In-page links (e.g. security "Fix" items) glide to their card                                                                                           | Only with `prefers-reduced-motion: no-preference`                                                                                                                                                  |
| Session list            | Current device plus three most recent, then "Show all N"                                                                                                | —                                                                                                                                                                                                  |
| Relative times          | "5 min ago" from translated catalogue messages; the runtime's Kinyarwanda data printed "-5 min"                                                         | —                                                                                                                                                                                                  |

## 7. Results (verified 2026-10-14)

**Gap status:** all §3 gaps marked "Fix (v2)" are implemented. P-01 (JS budget) remains open: the landing page now loads 253 KB of compressed JavaScript (main 239 KB, v1 249 KB, budget 200 KB).

**Automated accessibility (axe, WCAG 2.2 AA plus best-practice rules)** on 20 routes, phone and desktop:

| Locale       | Pages × devices | axe findings                            | Horizontal overflow at 360 px |
| ------------ | --------------- | --------------------------------------- | ----------------------------- |
| English      | 40              | **0** (v1: findings on 19 of 20 routes) | 0                             |
| Français     | 40              | 0                                       | 0                             |
| Ikinyarwanda | 40              | 0                                       | 0                             |

**Before → after (phone, English):**

| Page                 | Words                       | Graphics | Targets < 44 px |
| -------------------- | --------------------------- | -------- | --------------- |
| `/register`          | 43 → 43                     | 4 → 4    | 19 → 6          |
| `/privacy`           | 93 → 124 (highlights first) | 1 → 6    | 6 → 6           |
| `/settings/security` | 126 → 282*                  | 7 → 34   | 8 → 2           |
| `/backoffice/audit`  | 389 → 285                   | 1 → 89   | 2 → 2           |
| `/sign-in`           | 31 → 26                     | 2 → 2    | 4 → 2           |

\* Measured with 18 test sessions listed; the list is now capped at four with "Show all".

**Translations:** French and Kinyarwanda are complete drafts at 849 of 849 keys; v1 had 72 and 50. A unit test enforces key and ICU-argument parity for every future string. Native review is still needed before release, starting with:

- the Professional Body's official name
- category and role titles
- legal and privacy text
- licence and application status terms

**Tests:** 57 end-to-end tests pass, including the v2 regressions:

- the language never switches while scrolling
- the audit timeline filters and expands
- a pasted code submits on its own
- the protection summary
- the live password checklist
- the journey diagram's keyboard and reduced-motion behaviour

Unit tests pass (contracts 57, web 174). Lint, typecheck, format check and the production build pass.
