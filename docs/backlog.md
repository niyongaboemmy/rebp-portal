# Backlog after the pilot (R1.1 / R2 / R3)

Sizes: S ≤ 2 days, M ≤ 1 week, L > 1 week (one engineer with Claude Code). Dependencies in the last column.

## R1.1 — Pilot stabilisation (+1 week)

| Item                                                                        | SRS                 | Size | Depends on      |
| --------------------------------------------------------------------------- | ------------------- | ---- | --------------- |
| Approved RW/FR translations (drafts flagged; term list in D-023)            | UX-003              | M    | SME, translator |
| Official fee schedule loaded through configuration                          | FR-PAY-001, P3      | S    | Finance         |
| Legal texts: declaration, Article 10, code of conduct, obligations          | FR-J-001, FR-G1-005 | S    | Legal           |
| Full administrative divisions import (`prisma/import-divisions.ts`)         | FR-B-009, P5        | S    | ICT dataset     |
| Toast contrast in the shared Sonner theme (axe "serious" on success toasts) | UX-002              | S    | Design          |
| Assignment-scoped document reading for officers (D-020)                     | App. D              | S    | DPO decision    |
| Register search budget ignores router prefetches                            | FR-REG-005          | S    | —               |

## R2 — Go-live readiness (+4–6 weeks)

| Item                                                                                         | SRS                           | Size | Depends on          |
| -------------------------------------------------------------------------------------------- | ----------------------------- | ---- | ------------------- |
| Change of affiliation and reinstatement applications                                         | §3.3, BR-101/102, FR-F-010    | M    | —                   |
| Linked REBF + Principal Broker bundle decided together                                       | FR-FIRM-011                   | M    | —                   |
| Branch management and firm change requests                                                   | FR-FIRM-004/006               | M    | —                   |
| Maker-checker UI for checklist matrix, templates, conditions, reason codes                   | FR-ADM-002, FR-I-006          | L    | —                   |
| Refunds (maker-checker), real reconciliation file import                                     | FR-PAY-010/012                | M    | Gateway contract    |
| Real payment aggregator / mobile-money adapter                                               | INT-010, P6                   | M    | Credentials         |
| ClamAV and S3/MinIO adapters; resumable (tus) uploads                                        | FR-DOC-004/006/008            | M    | Infrastructure      |
| PAdES sealing with an accredited CA                                                          | FR-N-002                      | M    | CA contract         |
| OIDC IdP (Keycloak) and passkeys                                                             | FR-ACC-005/006, ADR-004       | L    | —                   |
| Lower-category approval with consent; committee and batch decisions                          | FR-M-004/014/016              | M    | SME rules           |
| Rule simulator; checklist & rules as versioned data                                          | FR-ELG-005                    | M    | —                   |
| Register: partner API, "report a concern", sanctions history, legacy import with claim codes | FR-REG-006/007, FR-RA-003/004 | L    | Legacy data         |
| BullMQ workers (move jobs off the HTTP scheduler), outbox for projections                    | ADR-006                       | M    | Redis in production |
| Move domain layer to `apps/api` (NestJS) if partner API or workers require it                | ADR-001                       | L    | —                   |
| DPIA, penetration test, WCAG audit, usability testing                                        | §19.3                         | L    | External parties    |
| Production infrastructure: IaC, backups, monitoring, SIEM                                    | NFR-AVL                       | L    | Hosting target (P7) |

## R3 — Integrations and modernisation (+6–10 weeks)

| Item                                                         | SRS            | Size |
| ------------------------------------------------------------ | -------------- | ---- |
| NIDA, RDB, RRA, police, education and exam-body integrations | INT-001…006    | L    |
| OCR pre-fill and mismatch flags; reusable document wallet    | FR-DOC-009/010 | L    |
| Wallet pass / verifiable credential; physical card printing  | FR-N-010/011   | M    |
| Offline-tolerant wizard (PWA sync)                           | FR-WIZ-011     | M    |
| Secure messaging per application                             | FR-PORTAL-005  | M    |
| Funnel analytics and statutory report pack                   | FR-RPT-004/006 | M    |
