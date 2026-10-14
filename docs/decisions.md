# Decision and assumption log

| ID    | Date       | Question                                                        | Decision                                                                | By                      | Reversible |
| ----- | ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- | ---------- |
| D-001 | 2026-10-14 | Where does authentication live before `apps/api` exists?        | In the Next.js server domain layer (ADR-001 amendment, ADR-004)         | Tech Lead               | Y          |
| D-002 | 2026-10-14 | Google sign-in for an email that already has a password account | Refuse and ask the user to link from Security settings; no silent merge | Tech Lead               | Y          |
| D-003 | 2026-10-14 | Absolute session lifetime (FR-ACC-010 gives no value)           | Applicants 12 h, staff 8 h                                              | Tech Lead (pending SME) | Y          |
| D-004 | 2026-10-14 | Brand assets (P8) not received                                  | Neutral teal/sun palette and placeholder mark                           | PM default              | Y          |
| D-005 | 2026-10-14 | Dependencies younger than 24 h                                  | Respect pnpm `minimumReleaseAge`; pin the previous release              | Tech Lead               | Y          |
| D-006 | 2026-10-14 | TypeScript 7 (native) vs 5.9                                    | 5.9.3 until Next.js tooling supports TS 7                               | Tech Lead               | Y          |
