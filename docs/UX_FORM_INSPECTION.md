# Application Form UX Inspection — REBP Portal

| Item     | Value                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Document | REBP-PORTAL-UX-003                                                                                                                         |
| Date     | 2026-10-16                                                                                                                                 |
| Scope    | The application wizard (FR-WIZ-001…014), using **Section F, Firm and supervision (RERA)** as the reference screen                          |
| Baseline | Branch `feat/pilot-delivery`, after commit `3bccaee`                                                                                       |
| Method   | Screenshot review, a code walk of `components/wizard/**`, and comparison with GOV.UK Design System, NN/g, Baymard, WCAG 2.2 and Material 3 |
| Related  | [UI_GAP_ANALYSIS_V2](UI_GAP_ANALYSIS_V2.md), [ADR-009 visual language](adr/ADR-009-visual-language.md)                                     |

---

## 0. Executive summary

The wizard is solid underneath. It autosaves, splits long sections into pages, links errors to their fields (GOV.UK
pattern), runs live eligibility and supports reduced motion. Where it falls short is in **how much it says at once**,
not in what it can do.

On the reference screen the applicant answers **one question**. Before they reach it, they pass **six layers of
status**: the stage strip, the phase eyebrow, the eligibility panel (three rows, a badge, a toggle and a disclaimer),
four page chips, an "All answered" pill and the "Why we ask" toggle. About **55% of the card's height is status and
only 20% is the form.**

Three problems matter most:

1. **The screen contradicts itself.** A green "All answered" sits under a red "Not eligible yet" panel. A blue,
   informational row sits inside a red container. "Fix in Firm and supervision →" appears while the applicant is
   already on Firm and supervision.
2. **Problems from other steps show on every step.** The criminal-record rule (Section H) appears on the firm page.
   It teaches applicants that the red box is background noise, so they also ignore it when it matters.
3. **Messages say what is wrong but not how to fix it.** "…is not in a category allowed to supervise this one" makes
   the applicant work out which categories _are_ allowed. Every error should guide to the fix: what happened, how
   to fix it, and a one-tap action (§4.3).

Section 6 has the prioritised fixes. The top five take roughly 2–3 days and remove most of the noise.

### Scorecard (1 = missing, 5 = international best practice)

| Dimension                          | Now | Target | Main gap                                                                    |
| ---------------------------------- | --- | ------ | --------------------------------------------------------------------------- |
| Minimalism / signal-to-noise       | 2   | 5      | Six status layers above one question                                        |
| Professional tone & consistency    | 3   | 5      | Contradicting signals and mixed colour semantics                            |
| Form length & effort               | 3   | 5      | Over-paginated (4 pages for ≈4 fields); asks things it could infer          |
| Microcopy & summarisation          | 3   | 5      | Rule messages say the problem, not the fix; hints repeat the labels         |
| Notifications                      | 2   | 5      | No scoping (local vs global) or severity ladder; a toast on every step      |
| Guidance for first-time applicants | 3   | 5      | Help is hidden behind a toggle; no preview of what a choice leads to        |
| Purposeful graphics & motion       | 3   | 4      | Motion is decorative (rise/pop); no graphic explains a relationship or rule |

---

## 1. Reading the reference screen

```
┌ card ───────────────────────────────────────────────────────────┐
│ YOUR PRACTICE                                   (i) Why we ask  │  ← layer 1: eyebrow + help toggle
│ Firm and supervision                                            │
│ ┌ RED panel ──────────────────────────────────────────────────┐ │
│ │ 3 things to check                       (!) Not eligible yet│ │  ← layer 2: global eligibility
│ │ (!) Licence RRA-… not in a category…  [Fix in Firm and …→]  │ │     ↳ self-link (bug)
│ │ (!) Criminal record … last 6 months.  [Fix in Integrity →]  │ │     ↳ belongs to another step
│ │ (i) Firm isn't on the register yet…   [Fix in Firm and …→]  │ │     ↳ info inside red; nothing to fix
│ │ Show fewer                 Indicative; confirmed by officer.│ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [1 Overview] [2 Firm] [3 Supervision] [4 Documents]              │  ← layer 3: page chips ("Overview" is a fallback label)
│ ✓ All answered                                                  │  ← layer 4: contradicts layer 2
│ How will you operate?                                           │  ← the actual task
│ [■ Through a licensed firm  ✓] [  Approved referral-only  ○]    │
│ [← Back]            Save and exit                    [Next →]   │
└─────────────────────────────────────────────────────────────────┘
```

### Findings from the code

| #   | Finding                                                                                                                                                                                                    | Where                                                                                                                                      | Severity |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| F1  | `EligibilityPanel` renders `<FixLink rule={rule} />` without `current`, so a link to the current step shows ("Fix in Firm and supervision" on Firm and supervision). `FixLink` already supports hiding it. | [wizard.tsx:793](../apps/web/src/components/wizard/wizard.tsx#L793), [fix-link.tsx:12](../apps/web/src/components/wizard/fix-link.tsx#L12) | High     |
| F2  | The panel's container colour comes from the worst outcome (`blocking ? danger : info`), so INFO and WARN rows inherit a red frame.                                                                         | [wizard.tsx:776](../apps/web/src/components/wizard/wizard.tsx#L776)                                                                        | Medium   |
| F3  | The panel lists **all** non-pass rules on **every** step, so rules for other steps (H: criminal record) repeat on F.                                                                                       | [wizard.tsx:766](../apps/web/src/components/wizard/wizard.tsx#L766)                                                                        | High     |
| F4  | `AnswersLeft` counts only missing answers, so it says "All answered" while a rule on the same step fails. The step navigator already knows this state (`blocked`).                                         | [wizard.tsx:231](../apps/web/src/components/wizard/wizard.tsx#L231), `stateOf()`                                                           | High     |
| F5  | The pager creates a page for every titled block. Its first, untitled block falls back to `pages.more` = "Overview", which is not what the page holds ("How will you operate?").                            | [section-pager.tsx](../apps/web/src/components/wizard/section-pager.tsx), `wizard.pages.more`                                              | Medium   |
| F6  | Every step change shows a "Saved" toast, although the save indicator in the rail already reports it. One status appears in two places.                                                                     | `go()` in [wizard.tsx](../apps/web/src/components/wizard/wizard.tsx)                                                                       | Low      |
| F7  | The "INFO" rule (`unverified` firm) has a "Fix in…" action even though the applicant has nothing to do.                                                                                                    | `RuleList` `action` for any non-PASS                                                                                                       | Medium   |
| F8  | The help sits behind a toggle (`helpOpen`), but it is most useful at the decision itself ("Approved referral-only arrangement": what counts as approved?).                                                 | header in [wizard.tsx](../apps/web/src/components/wizard/wizard.tsx)                                                                       | Medium   |
| F9  | The unselected choice card is nearly invisible on white (borderless surfaces, ADR-009 v4), so it reads as plain text rather than as a second option.                                                       | `ChoiceCards` in [fields.tsx:363](../apps/web/src/components/wizard/fields.tsx#L363)                                                       | Medium   |
| F10 | The "Fix in…" pills are about the same size and weight as the primary "Next" CTA, so they compete for the eye.                                                                                             | [fix-link.tsx](../apps/web/src/components/wizard/fix-link.tsx)                                                                             | Low      |

---

## 2. Minimalism and professionalism

**Principle.** A form screen should look like _a question_, not like _a dashboard about a question_. GOV.UK
("one thing per page"), Stripe and Linear keep status in the frame (rail, header) and keep the canvas for the
task. Professional means _calm and consistent_: one meaning per colour, one place per kind of information, and
nothing that contradicts itself.

### What works

- Single column, top-aligned labels and large hit targets.
- One primary action per screen. Back and Save and exit are visually secondary.
- The progress rail with phases (4 parts) matches the "chunk into 3–5 parts" guidance.
- The GOV.UK-style error summary, with links to fields and live shrinking.

### What to change

| Rule                                                    | Apply it as                                                                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One status surface per scope**                        | Global eligibility moves to the rail (desktop) or the progress header (mobile) as one line with a count: "2 to fix · 1 for the officer". The canvas shows only this step's issues. |
| **Colour per row, never per container**                 | The panel becomes neutral (`bg-surface-2` or none) and each row keeps its own tone. Red then means "you must act here".                                                            |
| **No colour without action**                            | INFO rows ("an officer will verify") turn grey with a clock icon and no button.                                                                                                    |
| **Status must agree**                                   | Replace "All answered" with the step state: `✓ Done`, `1 to fix` or `n left`, all from `stateOf()`.                                                                                |
| **Hide chrome the applicant can't use**                 | Don't show page chips when the section has 2 or fewer pages (see §3). Drop the eyebrow when the rail already shows the phase (desktop).                                            |
| **Weight hierarchy: question > answer > help > status** | The question in `text-lg font-semibold` (currently `text-sm font-medium`, smaller than the panel copy). Status at `text-xs` in muted colour.                                       |

**Target layout (same content, roughly 45% less height):**

```
┌ card ───────────────────────────────────────────────────────────┐
│ Firm and supervision                                   ✓ Saved  │
│                                                                 │
│ How will you operate?                                           │
│ Most applicants work through a firm.            (i) What's this?│
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ 🏢 Through a firm          ●│ │ 🤝 Approved referral       ○│ │
│ │ A firm + a supervisor       │ │ An approved referral scheme │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
│   ↓ revealed after choosing                                     │
│ Firm            [ Search firm name or TIN…            ]         │
│                 ⏱ Not on the register yet — an officer checks.   │
│ Supervisor      [ RRA-2025-00115                      ]         │
│                 ✕ This is an RERA licence. Choose a Broker,     │
│                   REA, Associate, Managing or Principal Broker. │
│ Start date      [ 16 Oct 2026 ]  (today)                        │
│                                                                 │
│ [← Back]              Save and exit                 [Continue →]│
└─────────────────────────────────────────────────────────────────┘
Rail: ● Your practice  1 to fix   ·  Elsewhere: Integrity — 1 to fix
```

---

## 3. Making the form shorter

Benchmarks: Baymard's checkout research repeatedly finds that **the number of visible fields drives abandonment**
more than the number of steps, and that most forms can lose 20–40% of their fields. GOV.UK: "ask only what you
need, and only once". WCAG 2.2 SC 3.3.7 (Redundant Entry) requires that information already given is pre-filled
or selectable.

### 3.1 Techniques, ranked by impact for this wizard

| #   | Technique                                 | Applied to REBP                                                                                                                                                                                                                             |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Infer instead of asking**               | `isAffiliated` (yes/no) can come from the firm lookup: a firm found on the register means affiliated, while "My firm isn't on the register yet" means proposed. That removes one question. Category changes the wording, not the field set. |
| S2  | **Pre-fill from the register**            | When the chosen firm is on the register, suggest its Principal and Managing Brokers as supervisors (one tap). Typing a licence number becomes the fallback. Most supervisors also come from the firm.                                       |
| S3  | **Smart defaults**                        | `affiliationStart` defaults to today (max +30 days is already enforced). Branch defaults to the only free branch when there is one.                                                                                                         |
| S4  | **Merge micro-pages**                     | Pager rule: a page needs **3 or more fields or a heavy group** (e.g. documents), otherwise it merges with the next one. Section F becomes 1 page (2 with documents) instead of 4.                                                           |
| S5  | **Progressive disclosure**                | Keep it for branches the applicant chose (already done). Never show a heading for an empty or not-yet-relevant group.                                                                                                                       |
| S6  | **Ask documents where they're triggered** | Show the upload slot under the answer that requires it (e.g. "Approval letter" under the referral reference) rather than on a separate "Documents" page. Section I stays the consolidated checklist.                                        |
| S7  | **Reuse across applications**             | Renewals and category changes pre-fill B–E from the last approved application and ask "Still correct?" for each section (one tap to confirm).                                                                                               |
| S8  | **Defer non-blocking questions**          | Questions an officer verifies anyway (e.g. supporting notes) are optional and collapsed under "Add a note".                                                                                                                                 |

### 3.2 Effort budget to track (per section)

| Metric                        | Target | Section F (RERA) now               |
| ----------------------------- | ------ | ---------------------------------- |
| Visible fields per page       | 3–7    | 1 / 2–3 / 1 / docs                 |
| Pages per section             | ≤ 2    | 4                                  |
| Typed (not picked) inputs     | ≤ 30%  | Licence number and dates are typed |
| Taps to complete (happy path) | ≤ 8    | ≈ 14 (incl. 3 "Next")              |

Add these as a Playwright metric (count `[data-path]` per visible page) next to the existing axe checks, so a
regression fails CI.

---

## 4. Summarising text

### 4.1 Rules for wizard copy

1. **Problem + fix in one sentence, at most 15 words.** Name the real values and never say "this one".
2. **Lead with the noun the applicant recognises** ("Your supervisor's licence…", not "Licence RRA-… is…").
3. **Hints add information, not restate the label.** If the hint only paraphrases the label, delete it.
4. **One idea per line.** Long legal context goes under "What's this?", with the article one more tap away (the
   `RuleDigest` pattern already does this for G).
5. **Plain-language level B1** (CEFR), the GOV.UK and EU standard. This matters for the rw and fr translations as well.
6. **Dates beat durations.** "Issued after 16 Apr 2026" is something the applicant can act on; "in the last 6 months" makes them calculate.

### 4.2 Rewrites for the reference screen

| Key                                  | Now                                                                   | Proposed                                                                        |
| ------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `rules.…category`                    | Licence {licence} is not in a category allowed to supervise this one. | {licence} is a {heldCategory} licence. Your supervisor must be a {allowedList}. |
| `rules.…fail` (criminal record)      | The criminal record certificate must be issued in the last 6 months.  | Your certificate is from {issued}. Upload one issued after {cutoff}.            |
| `rules.…unverified`                  | The firm isn't on the register yet; an officer will verify it.        | Firm not on the register yet. An officer will check it — nothing to do.         |
| `wizard.f.reraFirmHint`              | You refer clients under a firm and a supervising practitioner.        | A firm and a supervisor you name.                                               |
| `wizard.f.reraReferral`              | Approved referral-only arrangement                                    | Approved referral scheme                                                        |
| `wizard.f.reraReferralHint`          | An arrangement the Professional Body has approved.                    | Only if the Professional Body gave you an approval reference.                   |
| `wizard.eligibility.issuesTitle`     | 3 things to check                                                     | (step) 1 to fix here · (rail) 2 to fix, 1 for the officer                       |
| `wizard.eligibility.disclaimerShort` | Indicative; confirmed by an officer.                                  | Move to the "Not eligible yet" badge tooltip; don't repeat it on every step.    |
| `wizard.pages.more`                  | Overview                                                              | Use the question's legend as the page title; no chip when there's 1 page.       |

`{allowedList}` comes from `SUPERVISOR_CATEGORIES[category]` (BR-030) and `{cutoff}` is computed by the rule, so the
contract's `RuleResult.values` needs `heldCategory`, `allowed`, `issued` and `cutoff`. Shared logic stays in
`@rebp/contracts`.

### 4.3 Guide to the fix, not just the error

**Principle.** An error that only says what is wrong passes the work to the applicant. Every message the wizard
shows (field validation, eligibility rule, upload rejection, officer request) must **guide the applicant to the
fix**. Where possible, the fix should be one tap away.

**The message formula: what happened → how to fix it → the action.**

| Part              | Required             | Example (supervisor rule)                                                         |
| ----------------- | -------------------- | --------------------------------------------------------------------------------- |
| 1. What happened  | Yes                  | "RRA-2025-00115 is an RERA licence."                                              |
| 2. How to fix it  | Yes                  | "Your supervisor must be a Broker, REA, Associate, Managing or Principal Broker." |
| 3. The action     | Yes, when one exists | **[Pick from your firm's brokers]** · **[Enter another licence]**                 |
| 4. Why (optional) | No                   | "What's this?" → BR-030, one tap away                                             |

**Guidance ladder.** Use the highest level the case allows:

1. **Fix it for them.** Normalise input silently: `rra 2025 115` becomes `RRA-2025-00115`, dates accept `16/10/2026`,
   phone numbers accept spaces and `+250`. Report nothing.
2. **Offer the fix.** Give a one-tap correction: "Did you mean _Kigali Homes Ltd_?", "Use today's date",
   "Choose an allowed supervisor" (a list filtered to `SUPERVISOR_CATEGORIES`).
3. **Show the exact target.** Give the concrete value or date to meet: "Upload a certificate issued after
   16 Apr 2026", "Start date must be on or before 15 Nov 2026".
4. **Show how to get it.** For things obtained outside the portal: "Request a new certificate from RIB (Irembo,
   about 3 working days) → [How to request]". Mention that the application stays saved meanwhile.
5. **Say when there is nothing to do.** "An officer will check this — nothing to do." This is better than a red
   message the applicant cannot act on.

**Applied to every error type in the wizard:**

| Error type                    | Error only (avoid)                             | Guided (use)                                                                                                                             |
| ----------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Required field                | "Required"                                     | "Enter your firm's name or TIN — e.g. _Kigali Homes_ or _102345678_."                                                                    |
| Wrong format                  | "Invalid licence number"                       | "Licence numbers look like RRA-2025-00115." (and auto-format as the applicant types)                                                     |
| Out-of-range date             | "Invalid date"                                 | "Choose a date up to 15 Nov 2026 (30 days from today)." **[Use today]**                                                                  |
| Lookup not found              | "Firm not found"                               | "No registered firm matches _Kigali Hom_. Check the spelling, search by TIN, or **[add it as a firm not yet registered]**."              |
| Rule fails (supervisor)       | "Licence … not allowed to supervise this one." | Formula above, plus a filtered picker of eligible supervisors at the applicant's firm.                                                   |
| Rule fails (time window)      | "Must be issued in the last 6 months."         | "Your certificate is from 2 Mar 2026. Upload one issued after 16 Apr 2026." **[Replace document]** · **[How to get one]**                |
| Rule fails (not yet eligible) | "Experience requirement not met."              | "You need 24 months; you have 19. You become eligible on 3 Apr 2027 — save now and submit then." **[Remind me]**                         |
| Upload rejected               | "Upload failed"                                | "This file is 14 MB; the limit is 10 MB. Export the PDF at a lower quality or scan in black and white." **[Try again]**                  |
| Save failed                   | "Couldn't save"                                | "You're offline. Your answers are kept on this device and will save when you reconnect." (auto-retry, no action needed)                  |
| Officer request               | Officer's free text only                       | Officer text **plus** a generated checklist of the affected fields/documents, each with a "Go to" link, and the due date as a countdown. |

**Implementation notes**

- Add `fix` and `action` to `RuleResult` in `@rebp/contracts`: `fix` is an i18n key with values, `action` is
  `{ kind: "goToField" | "pick" | "replaceDocument" | "external" | "none", target }`. The UI then renders guidance
  from the contract and doesn't hard-code it per rule.
- Validation keys follow the same split: `validation.<code>` holds the problem and `validation.<code>.fix` holds
  the instruction. Lint (or a unit test over `en.json`) checks that every error key has a `.fix` sibling.
- "Fix in {step} →" becomes a **specific** action: it takes the applicant to the exact field
  (`focusField(path)` already exists in `step-status.tsx`), not just to the step.
- In the error summary, each line shows the instruction rather than the bare word "Required".

### 4.4 Summaries the applicant can scan

- **Answer summary chips** on a completed step ("Through a firm · Kigali Homes Ltd · RRA-2025-00115"), reused on the
  review step and on the collapsed phase in the rail.
- **Collapse finished pages** into a one-line summary with "Change", so the applicant sees proof of progress and not
  a wall of filled fields.

---

## 5. Interactive graphics and motion

**Principle.** A graphic earns its place when it **explains a relationship, a rule or a time window** that text
explains poorly. Decorative motion (rise, pop and parallax on every block) adds cost without helping
comprehension. Apple HIG, Material 3 and NN/g all frame motion as _feedback, orientation or causality_.

### 5.1 Graphics that would carry real information here

| Graphic                      | What it explains                                  | Behaviour                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supervision chain**        | Who answers to whom (BR-030, FR-F-007)            | A small inline SVG of three nodes, `You → Supervisor → Firm`. Each node fills as its field is answered, and the connector draws in (`animate-draw`, 600 ms). A failing rule turns that connector red with the reason on hover/tap. Afterwards it shows "Supervisor confirms after you submit" as a dotted future edge. |
| **Category ladder**          | Which categories can supervise mine               | A horizontal ladder (RERA → FSLA → REA → Broker → Associate → Managing → Principal). It highlights the applicant's position and the allowed supervisor range, and a typed licence shows as a dot on the ladder (red if outside). This replaces the abstract error.                                                     |
| **Validity window**          | Time-based rules (criminal record 6 months, etc.) | A bar from _issued_ to _expires_, a "today" marker and the submit date. Being outside the window is visually obvious, and the bar shows the exact date needed. Reuse it for licence renewals.                                                                                                                          |
| **Verification stamp**       | What an officer, not the applicant, will do       | A small "Officer check" token with a clock icon that ghosts in beside the firm field. It sets the expectation without red.                                                                                                                                                                                             |
| **Phase map (intro step A)** | The whole journey before starting                 | The `journey-diagram` from the landing page, cut to this application's actual phases and documents, with an estimated time per phase.                                                                                                                                                                                  |
| **Completion moment**        | Closure on submit                                 | One short, purposeful animation (check draw plus stamp) on the confirmation page. Not on every step.                                                                                                                                                                                                                   |

### 5.2 Motion rules

- **Motion follows a cause.** Animate when the applicant did something (choose, fix, upload). Don't animate on
  mount for every block.
- **Duration** 150–250 ms for UI feedback (`--dur-2/3`), at most 600 ms for an explanatory draw (`--dur-5`). No loops
  next to inputs (WCAG 2.2.2 covers motion that lasts more than 5 s).
- **Reduced motion:** final state immediately, no draw. The app already has `prefers-reduced-motion` blocks, so extend them to the new SVGs.
- **Graphics are never the only channel.** Every graphic has a text equivalent (`<title>`/`aria-describedby`)
  and the rule message stays in text.
- **Build cost:** inline SVG + CSS tokens, no new animation library (respects `minimumReleaseAge` / dependency policy).

---

## 6. Smart notifications

### 6.1 A severity and scope model

| Level       | Use for                                                  | Surface                                      | Persistence                    |
| ----------- | -------------------------------------------------------- | -------------------------------------------- | ------------------------------ |
| **Inline**  | A rule or answer on _this_ field                         | Under the field, tone colour, icon           | Until fixed                    |
| **Step**    | Problems on this step after "Continue"                   | Error summary (existing, GOV.UK)             | Until fixed; focus on show     |
| **Journey** | Problems in _other_ steps, overall eligibility           | Rail / mobile progress header: counts + link | Always visible, never loud     |
| **Toast**   | System events only: save failed, upload done, offline    | Sonner, bottom                               | 4 s; errors persist with retry |
| **Banner**  | Officer request (ACTION_REQUIRED), deadline              | Top of wizard (existing, warning tone)       | Until resolved                 |
| **Modal**   | Destructive or irreversible only (category change, sign) | Dialog                                       | Blocking                       |

### 6.2 When a rule speaks (timing)

- **Never fail a rule for a step not yet visited.** Before the applicant reaches Section H, "criminal record" is
  _upcoming_, not _failing_. Show it as pending (grey) in the rail.
- **Speak at the moment of cause.** The supervisor rule appears under the licence field when the lookup resolves,
  not in a panel above the question.
- **Speak once.** A rule appears in exactly one place: the field when on its step, the rail count when elsewhere,
  and the review step at the end.
- **Celebrate quietly.** A resolved rule shows a brief green check where the error was (`animate-pop`), then the row
  disappears and the rail count ticks down (`count-up`). This is the strongest motivator in the current toolkit.
- **Drop the per-step "Saved" toast** (F6). The rail's save indicator is enough; toast only on failure.
- **Out-of-app nudges:** email or SMS reminders for a draft idle for 3 days, and for officer requests 5 and 1 days
  before `dueAt`. They link back with `?step=` and need opt-in in settings. This is backlog, not pilot.

### 6.3 Accessibility of notifications

- Inline rule messages are linked with `aria-describedby` and announced through the field's existing live region. No
  `role="alert"` for non-blocking information, since an alert on every keystroke is hostile to screen readers.
- Colour is never the only signal: every tone has an icon, and the "to fix" counts are text.

---

## 7. Interactivity and guiding a new applicant

### 7.1 Patterns

| Pattern                       | Apply as                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contextual "What's this?"** | Replace the global "Why we ask" toggle with a link on the question that opens the explanation **beside** the field. The legal reference goes at the end in small text. |
| **Recommend a default**       | Under a choice, a muted line such as "Most applicants choose a firm" (only when true). This reduces choice anxiety without pre-selecting.                              |
| **Preview the consequence**   | After a choice, one line saying what comes next: "Next: your firm and supervisor (2 questions)". Applicants commit more readily when they can see the cost.            |
| **Examples in placeholders**  | The licence field shows its format (`RRA-YYYY-NNNNN`) and accepts lowercase or spaces, normalising input (forgiving format).                                           |
| **Live lookup feedback**      | While typing a licence or firm, show the matched holder's name and category as a card, with a check or cross before leaving the field.                                 |
| **Keyboard flow**             | Enter continues (already done). Choice cards can be selected with arrow keys (native radios do this; verify after `sr-only`).                                          |
| **Resume with context**       | On return: "Welcome back — you were on Firm and supervision. 2 parts left, about 6 minutes." (`rememberStepAction` already stores the step.)                           |
| **Time estimates per phase**  | The intro promises "About 15 minutes", so show remaining minutes in the rail, computed from fields left.                                                               |
| **Empty → guided state**      | The rail's eligibility area before any answers: "We'll check requirements as you go" with the shield illustration, not a blank space.                                  |
| **Undo over confirm**         | For reversible changes (switching operate mode), keep the answers (already done, per `changeWarning`) and offer "Undo" in a toast instead of a confirmation dialog.    |

### 7.2 First-run tour: deliberately minimal

Don't use multi-step coach marks; they are skipped and then forgotten. Use **one** dismissible tip on the first
wizard visit pointing at the rail ("Your progress and anything to fix lives here"), stored per user server-side
(not `localStorage`, so it works across devices, per FR-WIZ-004 "any device").

---

## 8. Prioritised backlog

| P   | Item                                                                                                  | Fixes  | Effort | SRS ref              |
| --- | ----------------------------------------------------------------------------------------------------- | ------ | ------ | -------------------- |
| P0  | Pass `current={step}` to `FixLink` in `EligibilityPanel`; no action on INFO rows                      | F1, F7 | XS     | FR-WIZ-007           |
| P0  | Scope eligibility: this step's rules inline/at the top, others as rail counts only                    | F3     | M      | FR-WIZ-005/007       |
| P0  | Step status from `stateOf()` replaces "All answered"                                                  | F4     | S      | FR-WIZ-005           |
| P0  | Neutral panel container; colour per row                                                               | F2     | XS     | UX-001               |
| P0  | Guided errors: `fix` + `action` on `RuleResult`, `.fix` keys for validation, "Fix" jumps to the field | §4.3   | M      | FR-WIZ-006/007       |
| P1  | Rewrite rule messages to problem + fix with real values (en, then rw/fr)                              | §4.2   | S      | FR-ELG-001, BR-030   |
| P1  | Pager: merge pages with fewer than 3 fields; page title = first legend; no chips when there's 1 page  | F5, S4 | S      | FR-WIZ-001           |
| P1  | Infer `isAffiliated` from the lookup; default start date; supervisor suggestions from the firm        | S1–S3  | M      | FR-F-001…009         |
| P1  | Unselected choice card gets a visible 1px border or a soft fill                                       | F9     | XS     | UX-003               |
| P1  | Question legend promoted to `text-lg`; help moved next to the question                                | F8     | S      | FR-WIZ-012           |
| P2  | Supervision chain + category ladder graphics                                                          | §5.1   | M      | FR-F-007, BR-030     |
| P2  | Validity window graphic for time-based rules                                                          | §5.1   | M      | FR-ELG-004           |
| P2  | Remove per-step "Saved" toast; toast only on failure                                                  | F6     | XS     | FR-WIZ-004           |
| P2  | Fields-per-page and taps metric in Playwright                                                         | §3.2   | S      | —                    |
| P3  | Remaining-time estimate, resume greeting, single first-run tip                                        | §7     | M      | FR-WIZ-004           |
| P3  | Idle-draft and deadline reminders (opt-in)                                                            | §6.2   | M      | notifications module |

XS < ½ day · S ≈ 1 day · M ≈ 2–3 days.

---

## 9. How to verify

- **Five-second test** on the redesigned F page: can a new user say what is being asked and whether anything is wrong?
- **Task test** with 5 first-time applicants per category (RERA, Broker, Managing Broker). Measure time on F, errors
  per step, and the number of times "Fix in…" or help is opened. Target: a median below 90 s for F with no unexplained errors.
- **Automated:** axe (WCAG 2.2 AA) stays green; fields-per-page metric; reduced-motion snapshot for new graphics;
  a test that no rule message appears twice on one screen.

## References

- GOV.UK Design System: question pages, error summary, task list, "check answers" patterns.
- NN/g: _Website Forms Usability_, _Progressive Disclosure_, _Indicators, Validations, and Notifications_,
  _The Role of Animation and Motion in UX_.
- Baymard Institute: checkout form-field research (field count vs abandonment, inline validation).
- WCAG 2.2: 1.4.1 Use of Color, 2.2.2 Pause/Stop/Hide, 2.3.3 Animation from Interactions, 3.3.1/3.3.3 Error
  Identification/Suggestion, 3.3.7 Redundant Entry.
- Material 3 Motion (durations and easing), Apple HIG (Motion; Feedback).
- Luke Wroblewski, _Web Form Design: Filling in the Blanks_.
