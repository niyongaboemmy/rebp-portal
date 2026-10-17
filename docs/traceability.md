# Traceability matrix — Pilot Release (R1)

SRS REBP-PORTAL-SRS-001 v1.0 → implementation → verification. Paths are relative to `apps/web/src`
unless they start with `packages/`. Status: **Done** (built and tested), **Lite** (core path, simplification
noted), **Adapter** (interface + mock), **R2/R3** (backlog, see [backlog.md](backlog.md)).

Test legend: **C** = `packages/contracts` unit tests (362), **I** = integration tests against Postgres
(`server/__tests__/licensing-loop.int.test.ts` and the auth/access suites), **E** = Playwright
(`e2e/licensing.spec.ts` full journey, `e2e/consoles.spec.ts` axe sweep, existing suites).

## Accounts, access, audit (E01–E03, E16)

| SRS ID                        | Implementation                                                               | Test    | Status |
| ----------------------------- | ---------------------------------------------------------------------------- | ------- | ------ |
| FR-ACC-001…004, 007, 008, 010 | `server/auth/*`, `(auth)/*`, settings/security                               | I, E    | Done   |
| FR-ACC-005/006                | —                                                                            | —       | R2     |
| FR-ACC-009 profile reuse      | `server/applications/applications.ts › prefill`                              | I       | Lite   |
| SEC-004, App. D               | `packages/contracts/src/roles.ts`, `server/access/*`, `config/navigation.ts` | C, I, E | Done   |
| FR-AUD-001…004                | `server/audit/audit.ts` (hash chain), `backoffice/audit`                     | I       | Done   |
| FR-AUD-005                    | dashboard activity feed                                                      | E       | Done   |

## Application wizard and sections (E04–E06)

| SRS ID                                     | Implementation                                                                               | Test | Status |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ---- | ------ |
| FR-DOM-001, FR-A-003…005                   | `packages/contracts/src/application.ts › categoryAvailability`, `applications/new`           | C, E | Done   |
| FR-A-001 reference + check digit           | `formatReference`, `isValidReference`, `application_ref_seq`                                 | C, I | Done   |
| FR-A-006 related licence                   | `createApplication` (renewal, upgrade)                                                       | I    | Done   |
| FR-WIZ-001…003                             | `stepsFor`, `components/wizard/wizard.tsx`                                                   | C, E | Done   |
| FR-WIZ-004 autosave + resume               | `wizard/context.tsx` (1.2 s debounce), `rememberStepAction`, `lastStep`                      | E    | Done   |
| FR-WIZ-005/006                             | step navigator states; `checkSection` issues on submit then live                             | C, E | Done   |
| FR-WIZ-007 live eligibility                | `saveSectionAction` → `runEligibility`; wizard eligibility panel                             | C, I | Done   |
| FR-WIZ-008 review + edit links             | `wizard/step-review.tsx`, `ApplicationSummary`                                               | E    | Done   |
| FR-WIZ-009 category change                 | `changeCategory` keeps hidden data                                                           | —    | Done   |
| FR-WIZ-010 pre-fill                        | renewal/upgrade pre-fill from the last snapshot                                              | I    | Lite   |
| FR-WIZ-011 offline                         | —                                                                                            | —    | R3     |
| FR-WIZ-012 help panel                      | "Why we ask" per step                                                                        | E    | Done   |
| FR-WIZ-013 submission gate                 | `submission.ts › readiness`                                                                  | I, E | Done   |
| FR-WIZ-014 reference + ack                 | N-011 email/SMS/in-app; acknowledgment PDF                                                   | I, E | Done   |
| FR-B-001…011, 013…016                      | `contracts/sections.ts › checkSectionB`, `wizard/sections/personal.tsx`, `address-field.tsx` | C, E | Done   |
| FR-B-012 map pin                           | —                                                                                            | —    | R2     |
| FR-C-001…006                               | `checkSectionC`, `sections/education.tsx`                                                    | C, E | Done   |
| FR-C-007/008 field mapping                 | `rules.ts › REA_RELEVANT_FIELDS`, `BROKER_FIELDS`                                            | C    | Lite   |
| FR-D-001…005, 007, 008                     | `checkSectionD`, `sections/training.tsx`                                                     | C, E | Done   |
| FR-E-001…009                               | `checkSectionE`, `computeExperience` (merge, suspensions), timeline visual                   | C, I | Done   |
| FR-F-001…006, 008, 009                     | `checkSectionF`, `sections/affiliation.tsx`, firm/licence lookups                            | C, E | Done   |
| FR-F-007 digital confirmation              | `server/confirmations/confirmations.ts`, `/confirmations`                                    | I, E | Done   |
| FR-F-010 affiliation records               | `Affiliation` model; end affiliation                                                         | I    | Lite   |
| FR-G-000, FR-G1…G8                         | `checkSectionG`, `sections/category.tsx`                                                     | C, E | Done   |
| FR-H-001…006                               | `checkSectionH`, `sections/integrity.tsx`, sensitive-view audit                              | C, I | Done   |
| FR-H-007 register cross-check              | —                                                                                            | —    | R2     |
| FR-J-001…007 declaration + OTP e-signature | `step-review.tsx`, `submission.ts › signAndSubmit` (snapshot SHA-256)                        | I, E | Done   |

## Documents (E08)

| SRS ID                       | Implementation                                                                           | Test | Status  |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ---- | ------- |
| FR-I-001…005 checklist       | `contracts/checklist.ts`, `wizard/step-checklist.tsx`, officer-named "Other"             | C, E | Done    |
| FR-I-006 configurable matrix | code-defined matrix                                                                      | C    | R2      |
| FR-DOC-001…003               | `documents/scan.ts` (magic bytes, extension, PDF active content, encryption, photo size) | I    | Done    |
| FR-DOC-004 malware           | `MalwareScanner` (signature/EICAR); ClamAV adapter R2                                    | I    | Adapter |
| FR-DOC-005/006               | client compression, multi-photo → PDF, XHR progress (chunked/tus R2)                     | E    | Lite    |
| FR-DOC-007/008               | versions; AES-256-GCM blob store; authorised route; watermarked staff downloads          | I    | Done    |
| FR-DOC-009/010               | —                                                                                        | —    | R3      |

## Rules, fees, payments (E07, E10)

| SRS ID                      | Implementation                                                                      | Test              | Status  |
| --------------------------- | ----------------------------------------------------------------------------------- | ----------------- | ------- |
| FR-ELG-001…004              | `packages/contracts/src/rules.ts`, `server/applications/facts.ts`, `EligibilityRun` | C (≈280 cases), I | Done    |
| BR-001…070, 100             | `evaluateEligibility` (table tests per rule)                                        | C                 | Done    |
| BR-034, 101, 102            | —                                                                                   | —                 | R2      |
| FR-ELG-005 simulator        | —                                                                                   | —                 | R2      |
| FR-PAY-001…003, 009, BR-080 | `contracts/fees.ts`, `payments.ts › feeQuote/startPayment`, versioned config        | C, I, E           | Done    |
| FR-PAY-004…007              | mock gateway, sandbox checkout, HMAC webhook, receipts                              | I, E              | Adapter |
| FR-PAY-008 waiver           | `waiveFee`, Finance console                                                         | E                 | Done    |
| FR-PAY-010 reconciliation   | `reconcilePayments` (delayed events, stale expiry)                                  | I                 | Lite    |
| FR-PAY-011 duplicates       | flagged `duplicate`                                                                 | I                 | Done    |
| FR-PAY-012 refunds          | —                                                                                   | —                 | R2      |

## Back office, decision, licence, register (E11–E14)

| SRS ID                               | Implementation                                                                    | Test | Status |
| ------------------------------------ | --------------------------------------------------------------------------------- | ---- | ------ |
| FR-BO-001, 004, 006                  | `/backoffice/queue`, `server/backoffice/queue.ts`, SLA badges, 360° panel         | E    | Done   |
| FR-BO-002/003, BR-093                | `assignment.ts` (load-balanced auto-assign, conflict guard, recusal)              | I    | Done   |
| FR-L-001…011, BR-090                 | `review.ts`, `/backoffice/review/[id]` (viewer, verdicts, overrides need reasons) | I, E | Done   |
| FR-L-007, FR-WF-002                  | information requests unlock named sections/documents                              | I    | Done   |
| FR-L-012/013                         | refer → FURTHER_ASSESSMENT; external verification requests R2                     | I    | Lite   |
| FR-M-001…013, 015, 017, BR-091/092   | `decision.ts`, `/backoffice/decisions/[id]`, decision letter PDF                  | I, E | Done   |
| FR-M-004/014/016                     | —                                                                                 | —    | R2     |
| FR-N-001…009, 012                    | `licensing.ts` (atomic, idempotent, retry job), certificate PDF + QR + seal       | I, E | Done   |
| FR-N-010/011                         | —                                                                                 | —    | R3     |
| FR-REG-001…005, 008                  | `register.ts`, `projection.ts`, `/register`, `/check/[number]`                    | I, E | Done   |
| FR-REG-006/007                       | —                                                                                 | —    | R2     |
| FR-RA-001/002, FR-WF-010/011, BR-050 | `register-admin.ts`, `/backoffice/register` (revoke maker-checker)                | I, E | Done   |
| FR-RA-003/004                        | —                                                                                 | —    | R2     |

## Lifecycle, firm, administration, reporting, notifications (E15, E17–E20)

| SRS ID                     | Implementation                                                          | Test | Status  |
| -------------------------- | ----------------------------------------------------------------------- | ---- | ------- |
| FR-REN-001…003, BR-040…042 | renewal type, `jobs/lifecycle.ts` (reminders, expiry, grace, lapse)     | I    | Done    |
| FR-NOT-005                 | 90/60/30/14/7-day reminders, de-duplicated                              | I    | Done    |
| FR-WF-004/006              | draft expiry, confirmation expiry/reminders, SLA warnings               | I    | Done    |
| FR-FIRM-001…003, 005       | `/firm`, roster CSV, confirmation inbox (bulk), end affiliation         | E    | Lite    |
| FR-FIRM-004, 006, 010, 011 | linked PB/REBF via BR-032 check only                                    | I    | R2      |
| FR-ADM-002…004, FR-ELG-002 | `config/config.ts` maker-checker, `/backoffice/configuration`           | I, E | Lite    |
| FR-RPT-001…003, 005        | `reports.ts`, `/backoffice/reports`, `/backoffice/finance`, CSV exports | E    | Lite    |
| FR-DSR-001                 | `/api/me/export`                                                        | —    | Done    |
| FR-NOT-001…004, App. C     | `notifications/inbox.ts` (in-app + email/SMS), header bell              | I, E | Adapter |
| FR-PORTAL-001…004          | dashboard, applications, status page, downloads, smart CTAs             | E    | Done    |
| UX-001/002/003             | mobile layouts, axe sweep (light/dark), EN complete + RW/FR drafts      | E    | Lite    |
