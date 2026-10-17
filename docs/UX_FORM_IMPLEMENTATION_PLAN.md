# Guided Form — Implementation Plan

| Item         | Value                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document     | REBP-PORTAL-UX-004                                                                                                                                    |
| Date         | 2026-10-16                                                                                                                                            |
| Input        | [UX_FORM_INSPECTION](UX_FORM_INSPECTION.md) (REBP-PORTAL-UX-003)                                                                                      |
| Scope        | The application wizard (`apps/web/src/components/wizard/**`), the rule contract (`@rebp/contracts`), the copy in `messages/*.json` and the e2e checks |
| Out of scope | Back office, public pages, and email/SMS reminders (listed in §9 as follow-up)                                                                        |
| Estimate     | ≈ 13–16 engineering days in 6 phases. Each phase can ship on its own.                                                                                 |

---

## 1. Review of the inspection

The inspection is sound, and its findings F1–F10 reproduce in the code. Before turning it into tasks, six points
need correcting or tightening.

| #   | Inspection says                                                       | Correction / decision                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | "Speak at the moment of cause": show the rule under the field at once | Eligibility runs **on the server after autosave** ([context.tsx:190](../apps/web/src/components/wizard/context.tsx#L190)), up to about 2 s later. **Decision:** keep the server authoritative. The field shows instant client facts (the lookup card already does), and the rule line appears after save with a quiet "Checking…" state in between. Rules are not duplicated on the client. |
| R2  | Supervisor rule should list the allowed categories                    | [LicenceLookup](../apps/web/src/components/wizard/lookups.tsx#L219) **already** shows the allowed categories inline. The fix is to **merge** the rule into that card, not add another message. Otherwise the inspection's own "speak once" rule is broken.                                                                                                                                  |
| R3  | "Never fail a rule for a step not yet visited"                        | No "visited" state exists: `attempted` is an in-memory `Set` that resets on reload. **Decision:** derive `reached(step) = index(step) ≤ index(furthest step with data or the current step)`, with no schema change. That is good enough for the rule, and it avoids a migration.                                                                                                            |
| R4  | Supervisor suggestions from the chosen firm                           | This needs a new lookup (`/api/lookup/firms/[id]/supervisors`). It must return **only public-register fields** (name, category, licence no.) and be rate-limited like the existing lookups. This is a privacy review item; the rest of Phase 3 does not depend on it.                                                                                                                       |
| R5  | First-run tip stored server-side                                      | That needs a `User` column (migration). **Decision:** P3. Use a `dismissedTips String[]` on `User` only when a second tip exists. Until then, `localStorage` is acceptable because the tip is a convenience and losing it costs nothing.                                                                                                                                                    |
| R6  | The inspection analyses Section F in depth                            | The other sections (B, C, D, E, G, H, I) have not been audited. Phase 3 begins with a **section audit table** (fields per page, inferable fields, defaults) so that "shorter" is measured rather than assumed.                                                                                                                                                                              |

The Baymard figures and the WCAG/NN/g citations are stated from memory and are directionally right. Cite the sources
in a PR, not exact numbers.

---

## 2. Definition of done for any wizard screen

A step passes review when all of these hold. Phase 6 turns them into automated checks where possible.

1. **One status surface on the canvas.** At most one issue block (this step's problems) appears above the first
   question. Journey status lives in the rail or the mobile header.
2. **No contradictions.** The step badge, the rail mark and the issue block come from one function (`stepState()`).
3. **Every non-pass message has a fix.** It has a `fix` text, plus an `action` unless the action is `none`, in which
   case it says "nothing to do".
4. **The question is the loudest thing after the title**: legend `text-lg font-semibold`, with status at `text-xs`.
5. **3–7 visible fields per page**, at most 2 pages per section (documents excepted).
6. **Colour belongs to rows, never containers.** Red appears only where the applicant must act.
7. **Motion only follows a cause.** It lasts ≤ 250 ms for feedback and ≤ 600 ms for explanatory drawing, and
   reduced motion shows the end state.
8. **axe WCAG 2.2 AA is clean**, the screen works at 360 px, and touch targets are ≥ 44 px.

---

## 3. Architecture changes

### 3.1 Contract: guided rule results (`packages/contracts/src/rules.ts`)

Add the fields needed to guide the applicant. All of them are optional, so the officer views and the existing tests
keep working.

```ts
export type RuleAction =
  | { kind: "goToField"; path: string } // focus the answer that causes it
  | { kind: "pick"; path: string; options: "supervisors" | "firms" } // offer a picker
  | { kind: "replaceDocument"; documentType: DocumentType }
  | { kind: "external"; guide: string } // i18n key of a how-to
  | { kind: "none" }; // officer action; nothing to do

export interface RuleResult {
  id: string;
  outcome: RuleOutcome;
  message: string; // "BR-030.category": what happened
  fix?: string; // "BR-030.category.fix": how to fix it
  action?: RuleAction; // the one-tap action
  field?: string; // data path the rule is about, e.g. "f.supervisorLicenceNo"
  values?: Record<string, string | number>;
  eligibleFrom?: string;
  evidence?: Record<string, string | number | boolean | null>;
}
```

- `field` replaces the numeric guess in [nav.tsx `stepForRule`](../apps/web/src/components/wizard/nav.tsx#L14):
  the step is `field.split(".")[0]`. `stepForRule` stays as a fallback for rules without `field`.
- `r()` gets `fix`, `action` and `field` through `extra`. Every rule in `rules.ts` (BR-001…BR-070, 21 ids) is
  updated in one PR. A unit test in `__tests__/rules.test.ts` asserts that **every non-PASS result has `fix`, or has
  `action.kind === "none"`**.
- Values the new copy needs: `heldCategory` and `allowed` (BR-030), `issued` and `cutoff` (BR-06x), and `have`,
  `need` and `eligibleFrom` (experience). The server serialises dates as ISO strings and the client formats them
  with `formatDay`.

### 3.2 Copy: problem and fix keys (`messages/*.json`)

- Rules: `rules.BR-030.category` (problem) and `rules.BR-030.category.fix`. Because next-intl cannot nest a key under a
  string, the problem moves to `.msg`: `rules.BR-030.category.msg` / `.fix`. A codemod (a node script in
  `scripts/`) rewrites the existing keys.
- Validation: `validation.<code>` → `validation.<code>.msg` / `.fix` (e.g. `required.fix` = "Enter {example}").
  Field components pass an `example` value.
- A unit test over `en.json` checks that every `rules.*` and `validation.*` leaf has a `.fix` sibling. `rw` and `fr`
  are filled with drafts marked `// TODO translate` in the PR description (they are drafts already, per CLAUDE.md).

### 3.3 One state function (`components/wizard/state.ts`, new)

Move `stateOf()` out of `WizardShell` into a pure, tested module:

```ts
export type StepState = "complete" | "inProgress" | "toFix" | "upcoming" | "officer" | "locked" | "notStarted";
export function stepState(step, { issues, attempted, rules, reached, readOnly, checklistDone }): StepState
export function stepRules(step, rules): { here: RuleResult[]; officer: RuleResult[] }
export function journeySummary(steps, ...): { toFix: number; officer: number; upcoming: number }
```

- `upcoming`: a failing rule whose step is not `reached` (R3). It shows grey in the rail and is never red.
- `officer`: the step's only open rules are `NEEDS_ASSESSMENT` or `action.kind === "none"`.
- The rail, the mobile header, the step badge (replacing `AnswersLeft`) and the issue block all read from this
  module. That fixes F4 structurally.

### 3.4 New or changed components

| Component                                              | File                               | Replaces / changes                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GuidedMessage`                                        | `components/ui/guided-message.tsx` | The shared row: tone icon, problem, fix, action button. Used by rules, validation and upload errors. The tone sits on the row and the container stays neutral. |
| `StepIssues`                                           | `wizard/step-issues.tsx`           | Replaces `EligibilityPanel` on the canvas. It shows this step's rules that are **not** attached to a visible field (field-bound rules render at the field).    |
| `FieldRule`                                            | `wizard/field-rule.tsx`            | Renders the rules whose `field` matches, under the field. It is read from context by `Field` through `data-path`.                                              |
| `JourneyStatus`                                        | `wizard/journey-status.tsx`        | "2 to fix · 1 for the officer" in the rail footer (desktop) and the mobile header. Each count opens a popover listing the items with "Go to" actions.          |
| `StepBadge`                                            | `wizard/step-status.tsx`           | Replaces `AnswersLeft`: `n left` / `1 to fix` / `✓ Done` / `Officer check`.                                                                                    |
| `RuleActionButton`                                     | `wizard/rule-action.tsx`           | Replaces `FixLink`. It runs `RuleAction`: `goToField` uses the existing `focusField()` (moved to `wizard/focus.ts`) and works across steps.                    |
| `SupervisionChain`, `CategoryLadder`, `ValidityWindow` | `components/graphics/*.tsx`        | Phase 4 inline SVGs (§4.4).                                                                                                                                    |

---

## 4. Phases

Each phase is one PR (or a few small ones) with SRS IDs in the title. Commit format:
`feat(wizard): FR-WIZ-007 guided rule results`.

### Phase 0 — Quick fixes (0.5 day) · P0

Ship these first. They fix most of what the screenshot shows wrongly.

| Task | Change                                                                                            | File                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0.1  | `action={(rule) => <FixLink rule={rule} current={step} />}` (pass `step` into `EligibilityPanel`) | [wizard.tsx:793](../apps/web/src/components/wizard/wizard.tsx#L793)                     |
| 0.2  | No action on `NEEDS_ASSESSMENT` rows                                                              | [rule-list.tsx](../apps/web/src/components/eligibility/rule-list.tsx) `action &&` guard |
| 0.3  | Panel container neutral (`bg-foreground/[0.03]`); rows keep `TONE_SOFT_BG`                        | [wizard.tsx:776](../apps/web/src/components/wizard/wizard.tsx#L776)                     |
| 0.4  | Hide `AnswersLeft` when the step has a failing rule (stopgap until 3.3)                           | [wizard.tsx:231](../apps/web/src/components/wizard/wizard.tsx#L231)                     |
| 0.5  | Unselected `ChoiceCards` get `border-foreground/12`, or `bg-foreground/[0.03]` when borderless    | [fields.tsx:363](../apps/web/src/components/wizard/fields.tsx#L363)                     |
| 0.6  | Drop the per-step "Saved" toast; keep the toast for save **failure** only                         | `go()` in [wizard.tsx](../apps/web/src/components/wizard/wizard.tsx)                    |

**Accept:** the reference screen shows no self-link, no red container around the info row, and no "All answered" next to a fail.
Update `e2e/experience.spec.ts` or `licensing.spec.ts` to match.

### Phase 1 — Guided errors (3 days) · P0 · FR-WIZ-006, FR-WIZ-007, FR-ELG-001

1. **Contract** (§3.1): add the types and fill `fix`, `action` and `field` for all 21 rule ids. Add the
   "every non-pass has a fix" test.
2. **Copy** (§3.2): run the codemod to `.msg`/`.fix`, write the en copy using the formula from the inspection
   §4.3 (what happened → how to fix → action), and add the sibling-key test.
3. **`GuidedMessage`** in `components/ui`, with variants `inline` (under a field) and `row` (in a list). The action
   is a `Button size="sm" variant="soft"`, kept visually below the primary CTA (F10).
4. **`RuleActionButton`** replaces `FixLink`. `goToField` across steps calls `go(step)` and then `focusField(path)`
   after the step mounts, using the existing `REVEAL_EVENT` for paged sections.
5. **Validation guidance**: `Field` renders `validation.<code>.fix` with the field's `example` prop. The error
   summary lines ([step-status.tsx](../apps/web/src/components/wizard/step-status.tsx)) show the fix instead of
   "Required".
6. **Forgiving input** (ladder level 1): normalisers in `@rebp/contracts` (`normaliseLicenceNo`,
   `normalisePhone`, `parseDayInput`), applied in `TextField`/`DateField` `onBlur` **and** in the Zod schema
   preprocess, so client and server agree.
7. **Upload errors**: `document-slot.tsx` maps size, type and scan failures to guided messages ("This file is
   14 MB; the limit is 10 MB. Export at lower quality…").

**Accept:** a unit test fails if any non-PASS result lacks guidance. In e2e, an RERA applicant entering an RERA
supervisor sees "…is an RERA licence. Your supervisor must be…", and the action focuses the licence field.

### Phase 2 — Scoped notifications and a quiet canvas (3 days) · P0 · FR-WIZ-005

1. Add `state.ts` (§3.3) with unit tests for every state transition, including `upcoming` before a step is reached.
2. **`FieldRule`** under each field. `Field` looks up rules by its `data-path` from the wizard context. For BR-030,
   render it **inside** the `LicenceLookup` card (R2) and delete the separate "allowed categories" line.
3. **`StepIssues`** replaces `EligibilityPanel` on the canvas and shows only unbound rules for this step. The badge
   "Not eligible yet" and the disclaimer move to `JourneyStatus` (tooltip).
4. **`JourneyStatus`** sits in the rail footer above the fee, and in the mobile header row next to `SaveIndicator`.
   Its counts animate with the existing `count-up`.
5. **"Checking…" state** (R1): while `saveState === "saving"` and a bound field changed, `FieldRule` shows a muted
   spinner line instead of the stale result.
6. **Resolved feedback**: when a rule goes from FAIL to PASS, its row shows `animate-pop` with a check for 1.2 s and
   then collapses (`grid-rows-[0fr]` transition, `invisible` after, per the CLAUDE.md rule on transient UI).
7. **Toast policy**: toasts only for save failure, upload done/failed and offline/online. Add one comment in
   `wizard.tsx` stating the policy.
8. **Header**: on `lg`, drop the eyebrow (the rail shows the phase). The help toggle moves to the question (Phase 5).

**Accept:** the reference screen has one issue surface (or none) above the question. The criminal-record rule does
not appear on Section F. A test asserts that no rule message text appears twice in the DOM.

### Phase 3 — Shorter form (3–4 days) · P1 · FR-WIZ-001, FR-F-001…009

1. **Section audit** (R6): a table in the PR for each section and category, covering fields per page, typed vs picked
   inputs, inferable fields, defaults and documents. Merge it into this doc as Appendix A.
2. **Pager rule** ([section-pager.tsx](../apps/web/src/components/wizard/section-pager.tsx)): count
   `[data-path]` per group, and merge a group with fewer than 3 fields into the next one (a document group always
   stands alone). The page title is the group's `h3`, otherwise the first `legend`. Show no chips when there is one
   page. Delete `wizard.pages.more` ("Overview").
3. **Section F**:
   - Infer `isAffiliated` from `FirmLookup`: a registered firm means `true`, and "My firm isn't on the register yet" means
     `false` (proposed). Remove `YesNoField`. A contract `preprocess` derives it on the server, so old drafts still validate.
   - Default `affiliationStart` to today on first reveal (written to data, so it autosaves and is visible).
   - Default `branchId` when exactly one branch has no manager.
   - Supervisor suggestions (R4): the new route returns the firm's eligible supervisors as pickable cards above the
     licence field ("Choose from Kigali Homes Ltd"). Typing a number stays as a fallback. **Needs a privacy check.**
4. **Documents next to their cause**: `StepDocuments` takes `near="path"` and renders the slot directly under the
   answer that triggers it. Section I stays the full checklist.
5. **Apply the audit** to B–H with the same three tools (infer, default, merge). Each section is its own commit.
6. **Done-page summaries**: a completed page collapses to one line of answer chips with "Change" (shared with
   `step-review.tsx`).

**Accept:** Section F (RERA, through a firm) has 1 page plus documents and at most 8 taps on the happy path. No section
exceeds 2 pages.

### Phase 4 — Graphics that explain (3 days) · P2 · FR-F-007, BR-030, FR-ELG-004

Use inline SVG with design tokens and no new dependency (`minimumReleaseAge` policy). Each graphic has a text
equivalent through `<title>` and `aria-describedby`, and all of them have reduced-motion styles in `globals.css`.

| Graphic            | Data source                                       | Interaction                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SupervisionChain` | `f` data, firm lookup, licence lookup, BR-030/033 | Three nodes (You → Supervisor → Firm). A node fills when answered and its edge draws (`animate-draw`, 600 ms). A failing edge turns red and is tappable, opening the rule's `GuidedMessage`. A dotted edge shows "confirms after you submit". Desktop: beside the fields; phone: above them, 72 px tall. |
| `CategoryLadder`   | `CATEGORY_INFO` order, `SUPERVISOR_CATEGORIES`    | Lives inside the licence lookup card when the category doesn't fit. It shows the applicant's rung, the allowed range and the entered licence's dot. Static, with no motion except the dot moving into place (200 ms).                                                                                    |
| `ValidityWindow`   | rule `values.issued`, `cutoff`, today, submit day | A bar under date-bound documents and fields (criminal record, exam validity BR-016). It shows the target date as a label, and the fix action sits on the bar ("Replace document").                                                                                                                       |
| Officer token      | `action.kind === "none"`                          | A small grey clock chip beside the field. No motion.                                                                                                                                                                                                                                                     |

**Accept:** visual review in light and dark mode at 360 px and 1440 px. With reduced motion there is no animation. The
graphics pass axe and add less than 6 KB gzip per graphic.

### Phase 5 — Guidance for first-time applicants (2 days) · P1/P3 · FR-WIZ-012, FR-WIZ-004

1. **Contextual help**: the global "Why we ask" toggle becomes a `What's this?` link on each legend. It opens an
   inline panel under the question (on desktop, beside it) holding the existing `steps.*.help` text, with the legal
   reference last. The legend is promoted to `text-lg font-semibold` (F8).
2. **Recommendation line** under choice cards (`ChoiceCards description` prop on the fieldset), only where the data
   supports it.
3. **Consequence preview** after a choice: "Next: your firm and supervisor · 2 questions", computed from the pager
   groups that the choice reveals.
4. **Placeholders as examples** for every typed field. Fix the `LicenceLookup` placeholder to the real format.
5. **Resume greeting** on the application page when `lastStep` exists: "You were on Firm and supervision · 2 parts
   left · about 6 min". The time estimate is fields left × 20 s, rounded and clamped to ≥ 1 min.
6. **Single first-run tip** on the rail (R5, `localStorage` for now, with try/catch).

### Phase 6 — Verification (1 day, then ongoing)

1. **Playwright metrics** (new `e2e/form-quality.spec.ts`). For each section and category in the seed, it asserts:
   visible `[data-path]` per page is between 3 and 7 (documents excepted), pages are ≤ 2, there is at most one
   `[data-issues]` surface above the first legend, no duplicate rule text, and an axe WCAG 2.2 AA pass.
2. **Reduced-motion snapshots** for the Phase 4 graphics (`page.emulateMedia({ reducedMotion: "reduce" })`).
3. **Unit tests**: `state.ts`, rule guidance completeness, `.fix` key completeness and the normalisers.
4. **Usability test** (inspection §9): 5 applicants per category (RERA, Broker, Managing Broker). Targets are a
   median under 90 s on Section F and no error they cannot explain.

---

## 5. Sequence and dependencies

```
Phase 0 ──► Phase 1 (contract + copy) ──► Phase 2 (scoping) ──► Phase 4 (graphics)
                     │                          │
                     └────────► Phase 3 (shorter form) ──► Phase 5 (guidance)
Phase 6 checks are added with each phase; the full spec lands last.
```

| Week | Work                                              |
| ---- | ------------------------------------------------- |
| 1    | Phase 0, Phase 1                                  |
| 2    | Phase 2, Phase 3 starts (audit, pager, Section F) |
| 3    | Phase 3 (B–H), Phase 5                            |
| 4    | Phase 4, Phase 6, usability test, fixes           |

---

## 6. Conventions this plan keeps

- **Contracts first:** rule guidance, normalisers and inferred fields live in `@rebp/contracts`, and the client and
  server share them.
- **Errors are i18n keys:** `.msg` / `.fix` everywhere. No English strings in components.
- **No new runtime dependencies.** The SVGs and motion use the existing tokens (`--dur-*`, `--ease-*`, `animate-draw`, `count-up`).
- **Audit:** inferred and defaulted values are written through the normal section save, so the existing autosave
  audit covers them. Nothing is written outside `src/server/**`.
- **Accessibility:** guided messages are linked by `aria-describedby`. `role="alert"` is used only for the error
  summary after "Continue", never for live rule updates.
- **Dev mode** is unaffected.

## 7. Risks

| Risk                                                        | Mitigation                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| The `.msg`/`.fix` key codemod breaks back-office rule views | The codemod also updates `RuleList` and officer views. Grep for `rules.` usages and run the e2e suite in CI.                       |
| Inferring `isAffiliated` changes saved data semantics       | Derive it in a contract `preprocess` only when it is absent, and keep the field in the schema. Existing drafts validate unchanged. |
| Supervisor suggestions expose more than the public register | The route returns register-projection fields only, is rate-limited, and goes through a privacy review before merge (R4).           |
| Merging pages moves fields that e2e tests locate by page    | The e2e tests locate by `data-path`, not by page index. Update them in the Phase 3 PR.                                             |
| rw/fr copy lags en                                          | They are drafts already. The sibling-key test enforces structure, not translation quality.                                         |
| Running in parallel with other sessions                     | Phases touch `wizard.tsx` heavily, so rebase before each PR (see the parallel-sessions note).                                      |

## 8. Files touched (summary)

`packages/contracts/src/{rules,application,sections}.ts`, `__tests__/rules.test.ts` ·
`apps/web/messages/{en,fr,rw}.json`, `scripts/split-rule-keys.mjs` ·
`components/wizard/{wizard,step-status,section-pager,fields,lookups,document-slot,step-documents,step-review,nav}.tsx` ·
new `components/wizard/{state.ts,focus.ts,step-issues,field-rule,journey-status,rule-action}.tsx` ·
new `components/ui/guided-message.tsx`, `components/graphics/{supervision-chain,category-ladder,validity-window}.tsx` ·
`components/eligibility/rule-list.tsx` · `app/globals.css` (reduced-motion for graphics) ·
new `app/api/lookup/firms/[id]/supervisors/route.ts` · `e2e/form-quality.spec.ts`.

## 9. Follow-up (not in this plan)

- Email and SMS reminders for idle drafts and officer deadlines (opt-in; `jobs/` + `notifications/`).
- Renewal pre-fill with "Still correct?" per section (inspection S7). Do this after renewal flows stabilise.
- `dismissedTips` on `User` when a second tip exists.

---

## 10. Implementation status (2026-10-16)

### Changes to the plan made during implementation

| #   | Plan said                                                 | Built instead, and why                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Split rule keys into `.msg` / `.fix` with a codemod       | Fix copy is a **sibling key** `<suffix>Fix` (e.g. `rules.BR-030.categoryFix`). Existing keys and back-office views are untouched; no codemod.                                                                                               |
| D2  | `.fix` keys for every `validation.*` message              | Not needed: the validation catalogue already guides ("Enter a valid email address, like…"). Only `errors.fileTooLarge` / `fileEmpty` were rewritten to say how to fix.                                                                      |
| D3  | Infer `isAffiliated` from the firm lookup                 | **Wrong inference**: a registered firm can be one the applicant only _proposes_ to join. The question is kept but asked after the firm is named, in its name ("Do you already work with Keza Realty?"). The contract requires it only then. |
| D4  | New route for supervisor suggestions                      | Not needed for the main case: the firm lookup already carries its Principal Broker (public register data), offered as a one-tap supervisor. Other licensees of the firm remain a follow-up (privacy review, R4).                            |
| D5  | `RuleAction` with `path` / `options`                      | Simpler union: `goToField` (uses the result's `field`), `replaceDocument`, `none`. `RULE_FIELDS` in the contract maps each rule to its answer.                                                                                              |
| D6  | Pager: merge pages with fewer than 3 fields into the next | It merges in both directions while the page stays at 7 fields or fewer. Otherwise a one-field "Supervision" page would remain.                                                                                                              |

### Delivered

- **Phase 0**: no self-link, a neutral issue container, no action on officer-only rows, a visible unselected choice card, no per-step "Saved" toast.
- **Phase 1**: the `RuleResult` fields `fix`, `action` and `field`, with richer values (`held`/`allowed`, `issued`/`cutoff`, `until`), and fix copy for all 33 FAIL/WARN outcomes in en, fr and rw. `FixLink` performs the action (focuses the exact field or upload, across steps). `normaliseLicenceNo` normalises licence input, and the lookups have `data-path` anchors.
- **Phase 2**: `state.ts` (pure, tested), `FieldRule` under the answer (with "Checking…" and "Sorted"), `StepIssues` only for rules no field shows, `JourneyStatus` in the rail and mobile header, `StepBadge` replacing "All answered", and page chips flagged by rule failures. The eyebrow is hidden on desktop.
- **Phase 3**: pager merge rule, pages titled by their question, and Section F reordered (firm first, then the affiliation question, start date defaulting to today, the only free branch preselected, Principal Broker suggestion).
- **Phase 4**: `SupervisionChain`, `CategoryLadder` and `ValidityWindow` (inline SVG/CSS, no new dependency; reduced motion handled by the global rule).
- **Phase 5**: the question legend promoted, "Next: …" preview on choice cards, a resume line on the application page, and one dismissible rail tip.
- **Phase 6**: `e2e/form-quality.spec.ts`, state, guidance and copy-completeness unit tests.

### Deferred

- Uploads rendered next to the answer that triggers them (S6) and collapsing finished pages into answer chips: both touch `step-review.tsx` and the checklist. Next round.
- Per-question "What's this?" help: the copy exists per step only, so the step-level "Why we ask" stays.
- Remaining-time estimate in the rail, "recommended" line under choices (no data to support it yet), and reminders (§9).

## Appendix A: fields per page (RERA, fresh draft; RERA has no Section D)

From `e2e/form-quality.spec.ts` (`test-results/form-quality.json`). These are visible top-level answers per page; conditional answers appear as the applicant chooses, and `0` is an uploads page.

| Section | Pages | Fields per page |
| ------- | ----- | --------------- |
| B       | 4     | 4 · 4 · 6 · 0   |
| C       | 2     | 1 · 0           |
| F       | 2     | 5 · 0           |
| G       | 1     | 1               |
| H       | 2     | 6 · 0           |

## 11. Round 2: cleaner, shorter, calmer (UX-005, 2026-10-16)

Review of the delivered wizard against minimalism, alignment, colour harmony and both themes. The main finding: **one answer produced up to five signals** (suggestion chip, amber "Valid" card, category ladder, legend, red rule block). They contradicted each other ("Valid" beside "can't supervise"), and the amber/red fills turned muddy in dark mode.

| Change                      | Rule applied                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One result per answer       | The licence lookup is one card: holder, **one verdict chip** ("Can supervise" / "Can't supervise" / licence status), the fix, and the one-tap suggestion inside it. The verdict is judged instantly from the register entry; the server rule adds only "self". The field claims its rule slot (`useRuleSlot`), so the rule is never repeated.               |
| Calm messages               | `GuidedMessage` and applicant-facing `RuleList` rows drop tinted fills for a 2 px tone rule and a tinted icon (`TONE_BORDER`). Officer views keep tinted rows.                                                                                                                                                                                              |
| Less text                   | Removed: the rail tip, the visible chain caption (it stays for screen readers), the "Next: …" previews, the validity bar and the category ladder (the fix text states the exact date and categories). Shorter copy for "On the register", "needs a fix" and the sensitivity notice.                                                                         |
| Shorter forms               | Yes/No questions share one row with their answer when the field is wide (the field is its own container), which roughly halves Integrity. `Grid` follows the form card (`@container/form`), not the viewport. Section F pairs the affiliation question with the start date (and referral name with reference). Page chips and the step badge share one row. |
| Before you start            | `/applications/new` shows the required documents and a line-by-line fee quote once a category is chosen, from the same `buildChecklist` / `calculateFees` the wizard and payment use.                                                                                                                                                                       |
| Responsive within the shell | Wizard breakpoints moved from the viewport (`lg:`) to the main container (`@4xl/main:`), so the sidebar never squeezes the form. On phones, fees show only on the Documents and Review steps, and requirements collapse to one row.                                                                                                                         |

## 12. Round 3: survey format (UX-006, 2026-10-16)

Goal: one question per screen, so each screen fits a laptop viewport (1440 × 900) without scrolling.

| Screen               | Before                                                                 | Now                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start an application | Type, category, "Before you start" and Start on one long page          | Three screens: _What do you want to do?_ → _Which category?_ → review (choices with "Change", documents, fees, Start). Choosing moves on; progress dots and Back.                                              |
| Wizard header        | Hero: reference, large title with underline, subtitle (~170 px)        | One line: title · type · reference; the reference is also the last breadcrumb (`BreadcrumbTail`).                                                                                                              |
| Step A (intro)       | Welcome hero, two info cards, a category card, the documents checklist | Welcome with three expectation chips, then one row: category with "Change", and Start. (The documents were already shown before the application was created.)                                                  |
| Paging inside a step | Blocks merged up to 7 answers                                          | One topic per page: a leading untitled block joins the next topic, two one-answer topics share a page, uploads stand alone. Topics that grow conditionally never merge, so pages don't reshuffle while typing. |

Fields per page (RERA): B 4 · 4 · 4 · 2 · uploads, C 1 · uploads, F 4 · 1 · uploads, G 1, H 4 · 2 · uploads.

## 13. Round 4: surfaces, colour and navigation (UX-007, 2026-10-16)

| Change             | What                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No solid borders   | `components/ui/surface.ts` defines `SURFACE` (fill + diffuse shadow), `SURFACE_MUTED`, `SELECTED` (primary tint with a faint inset edge), `HOVER` and `INTERACTIVE`. Choice cards, acknowledgments, repeated items, uploads, the review step, the licence/firm cards and the start-page cards use them instead of `border`. Inputs keep their outline (an editable field needs a visible edge). |
| Primary, not green | Done, eligible, "Sorted", progress, page chips, step marks, the chain and the experience meter use the primary colour. Red and amber remain for problems and warnings. Experience keeps its two kinds of period as solid vs soft primary.                                                                                                                                                       |
| Navigation         | One bar on the wizard and the start survey: Back and "Save and exit" on the left; "Up next: …" and Next on the right. On phones it floats above the shell's tab bar (`--bottom-nav-h`); on desktop it ends the card, so it never covers a control (WCAG 2.4.11, 2.5.8). The survey adds Continue for an answer already chosen.                                                                  |
| Smoothness         | Pages within a step slide in from their side (260 ms, skipped under reduced motion); cards lift and tint on hover with one easing curve.                                                                                                                                                                                                                                                        |

## 14. Round 5: attachments (UX-008, 2026-10-16)

| Change            | What                                                                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One compact row   | Each attachment is one row: a thumbnail, its name, a one-line summary with the status as a coloured dot ("Uploaded · id.pdf · 240 KB"), and only the actions that apply (Upload; or Replace / Remove / Add). Problems (blocked file, officer rejection) stay visible under the row. |
| Grid              | Attachments are two columns when the form card is wide (`@2xl/form`), on each step's Documents page and on the checklist. The checklist's per-item label lines are gone; a conditional document's reason is in its details.                                                         |
| Details on hover  | The name opens a hover card (hover, keyboard focus, or tap): what the document is, why it's needed, accepted formats, size and file limits, and each file with size, version and status.                                                                                            |
| Realistic visuals | Each document type has its own icon (`document-visuals.tsx`: ID, photo, certificates, transcript, criminal record…). Uploaded photos show as real thumbnails; PDFs as a page tile with a folded corner and its format. Hovering the thumbnail shows an eye.                         |
| Preview           | The thumbnail opens a preview dialog: images with zoom and rotate, PDFs in the browser's reader (same-origin frame), arrows (and ← →) between a slot's files, Replace and Download. Without a built-in PDF reader (`navigator.pdfViewerEnabled`), it offers "Open in a new tab".    |

## 15. Round 6: loading skeletons (UX-009, 2026-10-16)

Every wait in the application flow shows a skeleton shaped like what's coming, using the shared `Skeleton` (brand-colour shimmer, still under reduced motion), and announces one "Loading…" to screen readers.

| Wait                        | Before                                         | Now                                                                                                                       |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Opening the wizard          | The applications _list_ skeleton (wrong shape) | `applications/[id]/wizard/loading.tsx`: header line, stage strip, rail, form card with chips, choices, fields and nav bar |
| Start an application        | List skeleton                                  | `applications/new/loading.tsx`: header, survey dots, question and cards                                                   |
| An application's page       | List skeleton                                  | `applications/[id]/loading.tsx`: status hero and section cards                                                            |
| Firm search                 | Nothing until results                          | Three option-shaped rows in the dropdown                                                                                  |
| Supervisor licence lookup   | Nothing until the card                         | A result-shaped card (avatar, two lines, verdict chip) in the card's exact space                                          |
| Rule check after an answer  | Spinner and "Checking…"                        | A message-shaped placeholder                                                                                              |
| Photo thumbnails            | Image popped in                                | Shimmer tile, then the photo fades in                                                                                     |
| Preview dialog              | Blank until the file rendered                  | Page-shaped placeholder until the image or PDF loads                                                                      |
| First frame of a paged step | Whole section flashed, then collapsed          | The section stays invisible until its pages are measured                                                                  |

A failed lookup ends the wait (aborts from typing on don't), so a skeleton never spins forever. `e2e/form-quality.spec.ts` delays the licence lookup to check the skeleton appears and is replaced by the result.

## 16. Applicant profile: personal details entered once (UX-010, 2026-10-16)

Section B (personal details) moves out of every application and into the applicant's **profile**. The profile uses the same fields, the same contract schema (`sectionBSchema`) and the same check (`checkSectionB`), so "complete" means an application will accept it.

| Part           | What                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data           | `User.profile` (JSON) and `User.profileUpdatedAt`, migration `…_applicant_profile` (additive; the trigram index Prisma proposed dropping is kept). Same protection as `Application.data`. Only individual applicants hold one; organisations and staff are never asked.                                                                                                                   |
| Contract       | `profileFields()` and `profileCompletion()` in `@rebp/contracts` (done / total / percent / missing, an address counting as one answer), unit-tested.                                                                                                                                                                                                                                      |
| Server         | `server/profile/profile.ts`: `profileOf` (stored, or a start from the account), `profileStatus`, `profileBlocks`, `saveProfile` (validates, audits without PII, copies into drafts and into applications with Section B unlocked), `withProfile` (syncs a draft when opened). Action: `saveProfileAction`.                                                                                |
| Required first | The `requireUser` guard sends an applicant with an incomplete profile to `/settings/profile?welcome=1&next=…` (pages under `/settings/` are exempt, so no loop). Sign-in, two-step and contact verification decide the landing on the server (`landingFor`), so the client never chains a redirect out of the sign-in pages. `createApplication` refuses with `errors.profileIncomplete`. |
| Profile page   | `/settings/profile` (account menu, ⌘K, settings tabs): a live completion ring, "still to do" chips that jump to each answer, the wizard's own Section B form (grid, autosave, without uploads) via `ProfileFormProvider`, and Continue back to where the applicant was going.                                                                                                             |
| Application    | Step B is a summary of the profile ("From your profile": name, ID, date of birth, nationality, contacts, address, occupation) with "Edit in profile", then the ID and photo uploads. There is nothing to retype. New applications are prefilled from the profile.                                                                                                                         |
| Dashboard      | The "Finish setting up" card leads with the profile and its completion bar; done states use primary.                                                                                                                                                                                                                                                                                      |
| Tests          | `e2e/profile.spec.ts` (forced at sign-in, chip → field, completion, Continue; Section B as a summary). Fixtures and e2e users get a complete profile (`completeProfile()`, `makeUser`); the seed gives demo applicants one.                                                                                                                                                               |

**Identity documents on the profile (done).** Proof of identity and the passport photo are uploaded once on the profile (`ProfileDocument`: same checks, encrypted storage; owner-only reads at `/api/profile/documents/[id]`). Each open application gets its own copy (`Document.fromProfile`), so officers verify the file that was submitted. Copies follow the profile while a draft (or while the officer has that document unlocked). Files the applicant uploaded to an application directly are never touched. In an application these rows are read-only, with "From your profile". The completion rate counts both documents. The sign-in gate stays on the personal details (an applicant may not have the scans at hand), and the checklist still requires both files to submit. Covered by `src/server/profile/__tests__/profile.int.test.ts` and `e2e/profile.spec.ts`.

## 17. Profile in steps, with the photo in the ring (UX-011, 2026-10-16)

| Change            | What                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Steps             | The profile is paged by topic with the wizard's own pager: Your name · Identity · Contact · Address · Work · Identity documents (the address became its own group). Each tab shows ✓ when done, or a **red count of what's missing**. Moving between steps highlights the missing fields. Back / Next in the bar, Continue on the last step. |
| Photo in the ring | The completion ring frames the passport photo, the same file every application reuses, with the percentage as a badge. Click to add, or open Preview / Change photo / Remove. Phone photos are compressed before upload; the 600 px minimum still applies.                                                                                   |
| Reuse             | The application's step B header shows the profile photo beside "From your profile".                                                                                                                                                                                                                                                          |

## 18. Compact profile hero with a reacting companion (UX-012, 2026-10-16)

| Change      | What                                                                                                                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One hero    | The page header (title, underline, subtitle) and the progress card merged into one short row: the photo ring, the status as the page's `h1`, one line of what's left and the save state. The settings tabs follow it. On phones the sentence is dropped.                                            |
| Companion   | `ProfileBuddy`, a flat SVG figure in the eligibility companion's style. **Waves** (just started), **writes** on a clipboard (in progress), **holds up an ID card** (details done, documents missing), **cheers** (complete), is **worried** (save failed). A sync badge shows while a change saves. |
| Interaction | A short speech bubble per mood. The figure hops when an answer is completed. Tapping it jumps to the first step that still has something missing. It respects reduced motion.                                                                                                                       |
| Fixes       | An autosave that throws (connection dropped) now shows "Couldn't save" instead of "Saving…" forever (wizard and profile). Server-rendered photos no longer stay hidden when they load before hydration.                                                                                             |

## 19. One hero for every account tab (UX-013, 2026-10-16)

| Change        | What                                                                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared hero   | `SettingsHero` / `HeroCompanion` (components/layout/settings-hero.tsx) open Profile, Security and My access the same way: photo-in-ring (editable on Profile, a link to it elsewhere; initials in a full ring for accounts without a personal profile), title, one status line, tabs underneath.                |
| Per-tab scene | Profile: the five profile moods. Security: a **shield** when all four protections are on, otherwise a **padlock** snapping shut, with the first open item in the bubble ("Turn on two-step"); tapping goes to that card. My access: a **staff badge** on a lanyard, "N things you can do", linking to the list. |
| Loading       | `SettingsHeroSkeleton` in each tab's `loading.tsx` (the profile gained one).                                                                                                                                                                                                                                    |
| Tests         | access.spec uses the shared `settle()` (it skips the companion's looping animations).                                                                                                                                                                                                                           |

## 20. Save confirmation and a Save changes button (UX-014, 2026-10-16)

| Change       | What                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notification | Every profile change written to the database shows a "Profile updated" toast (it replaces a failed-save toast). Removing the photo is confirmed too.                                                     |
| Save changes | Each profile step's bar has **Save changes** next to Next/Continue: it saves at once, shows a spinner while saving, then turns into a disabled **Saved** ✓ until something changes. Autosave still runs. |

## 21. Profile photo in the account menu (UX-015, 2026-10-16)

The sidebar account button, the account menu's header, the phone account sheet and the public header's menu show the profile photo (initials stay underneath while it loads, and for people without one). `Avatar` takes an optional `src`, and `AccountUser.photoUrl` comes from `profilePhotoUrl()`. A new or removed photo refreshes the shell straight away, with no reload.

## 22. Experience step: guide the applicant to close the gap (UX-016, 2026-10-16)

| Problem (before)                                                                                                                                   | Change                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Fix this" did nothing while no period was entered: the rule points at `e.records`, and an empty list had no element to go to. No tab was flagged. | Lists carry `data-anchor` (`records`, `qualifications`); `fieldFor()` resolves it without counting it as an answer. "Fix this" now opens the list's page and focuses its first period or the Add button, and that page's tab shows the red count.                                                                                                                    |
| The card was a passive chart: "0 y 0 m of 3 years", an empty bar and a legend.                                                                     | **Experience coach**: the bar toward the requirement and the gap in words ("1 year 7 months to go. Only FSLA practice counts toward REA."), then **Ways to reach 3 years**: _Add a period of FSLA practice_ (adds a period already in a counting category, opens its page, focuses Firm) and, for REA, _Recognised equivalent experience?_ (jumps to that question). |
| Periods in a category that doesn't count, or without a start date, were silently ignored.                                                          | Each period shows **Counts toward REA** or why not ("RERA practice doesn't count toward REA", "Add its start date"); the coach lists them under **Not counted yet**, each with Fix → to the answer.                                                                                                                                                                  |
| "1 years 5 months".                                                                                                                                | Plural-aware durations in the coach and in the BR-020/021 messages (en).                                                                                                                                                                                                                                                                                             |

`ExperienceSummary.qualifyingCategories` (contracts) tells the page which categories count. Covered by `e2e/experience-coach.spec.ts`.

## 23. Primary colours only, lists in dialogs, a lighter form (UX-017, 2026-10-16)

| Change          | What                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colours         | The application flow (wizard + application pages) uses the primary family and neutrals only: info, success and warning tints became primary-soft / `text-link`; red stays for errors and "to fix" counts. The experience coach lost its amber total, purple gradient and amber "not counted" rows.                                                        |
| Lists → dialogs | `ItemList` (wizard/item-list.tsx) for periods of practice, qualifications, disclosures, the firm's responsible persons and branches: one compact row per item (icon, title, key facts, status or "N to fix", edit, remove), answers in a dialog (bottom sheet on phones). An empty list is a single "Add …" tile. A new item closed untouched is dropped. |
| Fix links       | `focusField()` opens the item that holds an answer (`OPEN_ITEM_EVENT` on its row, after revealing its page), then focuses the answer in the dialog.                                                                                                                                                                                                       |
| Lighter surface | Grey panels inside the form card (`bg-surface-2`, `bg-foreground/[0.03]`, `SURFACE_MUTED`) are now white with a hairline ring; the coach sits on a faint primary wash.                                                                                                                                                                                    |

## 24. The applicant's CV, and issues as cards (UX-018/019, 2026-10-16)

**Analysis: what belongs to the person, what to the application.** Education (C), training and exams (D) and experience (E) are the person's credentials: the same for every category they apply for, and growing over a career. Re-typing them per application was the biggest repetition left after the profile (UX-010). What an application decides for itself stays in it: which qualification it relies on for its category, the practice arrangement (F/G), the integrity declaration (H, re-sworn with a fresh certificate each time), documents for that application only, and the signature.

| Change          | What                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data            | `User.cv` (JSON: sections C/D/E) + `cvUpdatedAt`; contracts `cv.ts`: `cvSchema`, `toCv` (drops `reliedUpon`), `fromCv` (keeps each application's choice; the first qualification by default), `checkCv` (section checks less application-only ones), `cvCompletion`. `CV_DOCUMENT_TYPES` (certificates, transcripts, recognition, training, exam, experience evidence, equivalence, previous licence) live on the profile like ID and photo. |
| Two-way sync    | Saving C/D/E in any application saves the CV and copies it into the applicant's other drafts (and unlocked sections); editing the CV does the same. Opening an application syncs it (`withCv`). New applications start from the CV. Applicants who had none start from their latest application. Audited (`profile.cv_updated`, `application.section_updated` with `source: "cv"`).                                                          |
| CV page         | `/settings/cv` (account tab "CV"): the shared hero (photo ring, companion), three parts (Education · Training & exams · Experience) with missing counts, the wizard's own sections in CV mode (no category wording, no relied-upon choice), the CV's evidence uploads, Save changes, and a live CV preview — photo, name, contact and timelines, as an officer reads it. Dashboard setup lists "Build your CV" with its percentage.          |
| In the wizard   | Steps C/D/E say "Saved to your CV · Every application uses it · Open CV".                                                                                                                                                                                                                                                                                                                                                                    |
| Issues as cards | `IssueCard`: the topic as an icon and one word (Experience, Supervisor…), the finding, a meter when it's a number to reach (experience, age), the fix as a path — where (step chip) → what (fix chip) — and one **Fix now** button. Red only for what blocks. The error summary is a count to bring to zero with numbered tiles that go to each answer.                                                                                      |

## 25. Show, don't tell (UX-020, 2026-10-16)

| Before (words)                                                                                                         | After (graphics)                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A sentence per problem plus a sentence of advice.                                                                      | `issue-visual.ts`: topic icon + one word, a **verdict pill** from the message's ending ("Missing", "Expired", "7 months short", "Under 18"), a **meter** with the gap hatched and a flag at the target, and an **action verb** button ("Add experience"). The sentences sit behind **Why?**. |
| Field messages under answers (two lines of text).                                                                      | `IssueLine`: icon, verdict pill, eligible date, meter, **Why?**.                                                                                                                                                                                                                             |
| Experience coach: "7 months to go. Only FSLA practice counts toward REA.", hints under tiles, a sentence for the date. | Pills: 🏁 **7 months to go** · ✓ **FSLA counts** · 📅 **Eligible May 15, 2027**; action tiles are just their titles. The coach owns the experience rule, so the issues block doesn't repeat it.                                                                                              |
| Where to start on a page: read the questions.                                                                          | A pulsing **dot beside the next open answer** (`NextFieldMarker`, wizard, profile and CV); it moves as answers are given.                                                                                                                                                                    |

## 26. Qualifications belong to the profile, before applying (UX-021, 2026-10-16)

| Change             | What                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before applying    | `cvMissingFor(cv, type, category)` (contracts): the CV parts a NEW application of that category needs (RERA: education; FSLA: + training; REA/Broker: + experience) that aren't ready. "Before you start" shows them as tiles (✓ / Missing) and the Start button becomes **Complete your CV**, which comes back to this choice. The server refuses to create the application otherwise (`errors.cvIncomplete`). |
| In the application | Education, Training and Experience are **"From your CV" summaries** for individuals (`CvStepSummary`): facts as tiles, qualifications as cards to tick **Rely on for this application** (the one choice made there), the experience coach for the category, and the step's uploads. **Edit in CV** / **Complete in CV** open the CV at that part with **Back to application**.                                  |
| Fixes go to the CV | `useRuleFix` sends a rule on C/D/E to `/settings/cv?part=…&focus=…&next=…`; the coach's "Add a period of FSLA practice" opens the CV with a new FSLA period (`?add=FSLA`).                                                                                                                                                                                                                                      |
| Demo and tests     | `src/test/sample-cv.ts`: demo applicants (seed) and test users (fixtures, e2e) have a complete CV.                                                                                                                                                                                                                                                                                                              |

## 27. Compact experience ring, a wrapping verdict, a clear Edit (UX-022, 2026-10-16)

| Change             | What                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements panel | The title and the verdict chip wrap in the narrow rail instead of overflowing; the opened list uses the same `IssueCard`s as the step.                                                                                                                                                          |
| Experience coach   | A **segmented progress ring** (one slice per period, register vs declared, a flag or tick at the target, years in the centre, drawn in) beside the pills and **period chips** sized to their text. Hovering or focusing a chip lights its slice. About half the height of the bar and timeline. |
| Documents          | A file's actions are one **Edit** button (pencil + label) opening a named menu: Replace file, Add another file, Take a photo (phones), Remove — instead of three unlabelled icons.                                                                                                              |

## 28. "Your practice": find, see, and go to the fix (UX-023, 2026-10-16)

| Change                | What                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supervisor lookup     | Type a **name or part of a number**: matches from the register (active licences allowed to supervise, `GET /api/lookup/licence?q=…&categories=…`, `searchLicences()`) as cards with **Choose**. While a number is typed, a **format guide** (Category · Year · Number) fills in and highlights the next part. The register is asked for a verdict only once the number is whole, so a half-typed number no longer reads "Not found". Names are kept as typed. |
| Supervision diagram   | Nodes are buttons to their answer (firm, supervisor), each with a status mark (✓ / !) and one word (Confirmed, Fix this, Add, Checking…). The supervisor node reads "Supervisor" until the number is whole.                                                                                                                                                                                                                                                   |
| "1 to fix" goes there | The step badge ("1 to fix", "3 answers left") is a button to the first failing answer (else the first missing one, now highlighted). In the rail, a part with problems opens its first step that has them.                                                                                                                                                                                                                                                    |
| Category requirements | "What you've already told us" is a board: what needs work as `IssueCard`s (verdict + "Update education"…), what's settled as a grid of **Met** tiles (`MetTile`) — no green, no paragraphs.                                                                                                                                                                                                                                                                   |
| Integrity             | A declaration tracker: a shield per question (open, No ✓, Yes → details), "1 of 4 answered", each a way to its question; the privacy note folded into one line.                                                                                                                                                                                                                                                                                               |

## 29. Missing documents: a symbol, not a colour (UX-024, 2026-10-16)

A required document with no file shows a small **yellow "!"** on its icon, an optional one a **yellow dot**; both pulse softly (and hop when the row is hovered) so the eye finds them, and stay still with reduced motion. Nothing else changes colour (an earlier yellow card and pill were removed at the user's request: too disturbing). Missing documents are listed first in the checklist, and the profile's ID and photo count as missing in an application when the profile has none. On the CV, evidence is optional (dot only, no "because of your answers").

## 30. Soft ticks, one dark palette, no overflow (UX-025, 2026-10-16)

| Change         | What                                                                                                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soft ticks     | Done marks are light (primary-soft or white disc, thin primary ring, 2.5 stroke) instead of solid blue discs: the rail's step marks, the CV parts, the supervision chain, the experience ring's target, "Before you start". "Met" tiles carry a small tick beside the word, no badge.                                               |
| Dark palette   | The form's panels use `bg-card` like the app's cards; inner surfaces use the blue-tinted `surface-2` / `surface-3` (and `SURFACE`, `SURFACE_MUTED`, `HOVER`) instead of translucent white, which read grey against the app.                                                                                                         |
| Responsiveness | Grids that hold rows declare `grid-cols-1` before their wider layout, so a long file name can't widen the implicit column past the screen (document rows overflowed by up to 65 px on phones). Checked at 360, 390 and 768 px on every step, the CV and the profile: no horizontal overflow. The reference number no longer breaks. |

## 31. Review: sections as one list group (UX-026, 2026-10-16)

On the review step (and wherever `ApplicationSummary` is collapsible), the sections are one panel with hairline dividers instead of a card per section with a boxed row inside: each row is the letter tile, the title, the answer count, a chevron that turns when open, and **Edit**; an open section expands in place on a faint tint. Years show as written ("2016", not "2,016"). Non-collapsible summaries (back office) keep their cards.

## 32. Sign, Pay and Submitted in the Fill-in design (UX-027, 2026-10-17)

| Change     | What                                                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One header | `ApplicationHeader`: category · type · reference on one line (and Withdraw where it applies), then the stages bar — on Fill in, Pay and the status page alike; the big underlined page titles are gone.                                                                    |
| One panel  | `PANEL` / `PANEL_ROW` (surface.ts): the form's card (soft depth in light, hairline in dark, no solid border) for the fee breakdown, payment methods, checkout, status, confirmations, timeline, files and payments; rows are white with a hairline instead of grey blocks. |
| Sign       | A **signing path** (Check answers → Accept → Sign) whose nodes light up and jump to their part; blockers as `IssueCard`s; fees as one row (total, "Paid after you sign", lines on demand); the declaration in a short scroll box.                                          |
| Pay        | The total first, the lines as a list group; methods as the form's choice cards with a soft tick; a rounded Pay button.                                                                                                                                                     |
| Submitted  | The success modal opens on its own after submitting (after payment, or right after signing when there is nothing to pay); its main action is **Continue to my applications**, with "Track my application" beside it.                                                       |
| Tones      | "Good" and "info" statuses are the primary family app-wide (Paid, Confirmed, Pending use primary with their icon); a pending confirmation is a calm clock, not a warning. The celebration's tick is primary.                                                               |

## 33. Applications list and status: whose turn, live (UX-028, 2026-10-17)

| Change         | What                                                                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle      | `lib/lifecycle.ts`: one six-step journey (Fill in, Sign, Pay — _you_; Confirmations, Review, Decision — _regulator_) mapped from every status, with a state (active, attention, done, refused, stopped) and the companion's mood.                                                                                                 |
| Track          | `LifecycleTrack`: done steps carry a soft tick, the current one pulses (red when the applicant must act), what's ahead is dashed, the line fills as it advances; on narrow widths only the current step is named. `compact` (dots + "Step n of 6") is for the list cards.                                                         |
| List           | A hero with three counts (your turn, in review, finished), **New application** and the companion acting the overall state; filter tabs by whose turn it is; a card per application with its track, draft progress ring or what happens next, unread updates and one action; a dashed "New application" card.                      |
| Status         | A **back link** ("My applications") on the status, wizard and pay pages. The hero gives step n of 6, the status, what happens next and the CTA, with the companion (new `pay` and `waiting` moods) and the track on its own shelf beneath. Confirmations show a ring (1/2) and a list group with a yellow marker on pending ones. |
| Notifications  | An **Updates** feed on the status page (the inbox items for this application, unread dotted); unread counts on the list cards; a **Live** chip that refreshes the page every 30 s while the tab is visible and on return to it.                                                                                                   |
| Empty sections | The timeline is hidden until there is an event.                                                                                                                                                                                                                                                                                   |

## 34. Applicant dashboard: a decision at a glance (UX-029, 2026-10-17)

| Change       | What                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero         | `hero-surface`: the day, the greeting, a one-line verdict ("2 things need you", "the regulator has it from here", "all caught up") and **Next for you** — the single most urgent thing with its button. The companion acts it out. |
| Priority     | Information request → renewal (late, then open) → payment → confirmations to give → draft → waiting on the regulator → active licence → start an application.                                                                      |
| Four numbers | Your turn (yellow marker when > 0), in progress (with how many people it waits on), active licences (next expiry), account (ring). Each opens its page.                                                                            |
| To do        | One list group split into **Your turn** (animated yellow markers, red for urgent) and **Waiting on others** (a calm clock); drafts are included.                                                                                   |
| Applications | Up to three, each with the category tile, status and the compact six-step track; empty: the full track and Start / Check eligibility.                                                                                              |
| Side column  | Licence card beside its validity ring and expiry date; account setup as a list group (soft ticks, yellow markers, profile/CV progress); the latest notifications (unread dotted); account activity — last on phones.               |
| Surfaces     | Flat panels with hairlines (no shadows), the same as the applications pages.                                                                                                                                                       |

## 35. Physical cards, lit surfaces and the licence wallet (UX-030, 2026-10-17)

| Change           | What                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TiltCard`       | A card that tilts toward the pointer with inertia (rAF-eased `--rx/--ry`), a glare that follows it and a holographic foil that shifts with the angle (`--gx/--gy`). Touch: a slow sway and drifting foil. Reduced motion: still. Transform only. |
| `SpotlightGroup` | One pointer listener lights every `[data-spot]` surface where the cursor is (a soft primary glow under the content). `display: contents`, fine pointers only.                                                                                    |
| Dashboard        | Hero and number tiles are lit; the licence panel shows the real card (live QR) in a `TiltCard` over a pool of light, with its countdown ring and status.                                                                                         |
| Wallet hero      | Title, three stats (active, next expiry, renewals due — yellow marker), Verify a licence, and the companion (badge when licensed, worried and red only when a renewal is late).                                                                  |
| Wallet stage     | The chosen licence (`?licence=`) as a tilting card beside its validity: ring, the term as a line with today pulsing on it, status, firm, flags; renewal as its own card when open; the public register entry.                                    |
| Show QR          | A dialog to present the licence in person: a large QR in a viewfinder with a scan line, the number, holder and category, live status, a brightness tip and Copy verification link.                                                               |
| Several licences | A list group of miniature cards to switch the one on stage (current marked, renewals flagged).                                                                                                                                                   |
| Empty wallet     | A ghost card ("Your name here", a dashed QR) turning in the light, the six-step journey to a licence, Start / Am I eligible?                                                                                                                     |

## 36. Smooth light surfaces, a companion that notices you, harmonised tabs (UX-031, 2026-10-17)

| Change          | What                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ambient + glass | The content pane carries a faint primary/sky wash (`.ambient`); panels are translucent glass over it (`.glass`, a primary-tinted hairline) instead of flat white blocks — `PANEL`, the dashboard tiles, the board cards, the profile, CV and application form cards. No backdrop blur (it would capture fixed popups). Dark keeps its card surfaces. |
| Companion       | `LookAtPointer`: the eyes follow the pointer and the head leans toward it (`--look-x/--look-y` on `.pb-look` / `.pb-head` via `translate`, composing with the blink and tilt animations). Dashboard, applications, status, wallet and the account heroes.                                                                                            |
| Dashboard tiles | The four numbers tilt gently under the pointer (`TiltCard`, no foil) and are lit by the spotlight.                                                                                                                                                                                                                                                   |
| Colour harmony  | Foil in the primary family only (blues and white); the validity ring is primary until the last 30 days (then red); the card's live dot is blue; My access grants are soft primary ticks, not green; the account header uses `hero-surface`.                                                                                                          |
| Wallet header   | Eyebrow, title, a glass strip of three numbers (active, days to expiry, renewals due), a primary **Renew now** (or **Open my licence**) and **Verify a licence** as a soft primary button — never an outline that reads as disabled.                                                                                                                 |
| Tabs            | Account tabs (`LinkTabs`): a quiet track, the active tab a raised surface with a primary icon. Section tabs (profile steps, CV parts): selected is a soft primary tint and edge, not a solid fill with a glow; done is a soft tick, missing stays a red count.                                                                                       |
