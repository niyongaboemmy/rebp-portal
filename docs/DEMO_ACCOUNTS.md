# Demo accounts

These accounts cover every validation step an application passes through, in order. They exist only in the pilot,
dev and test databases. Production is never seeded with them, because the password below is public. Production gets
its administrator from `deploy/cpanel/create-admin.cjs`.

**Password for every account:** `Rebp-Demo-Pilot-2026` (override with `SEED_DEMO_PASSWORD`).

## Seeding

```bash
pnpm db:seed                                                    # the accounts below, firms, register sample
SEED_APPLICATIONS_PER_STATUS=4 npx tsx prisma/seed-applications.ts   # (apps/web) applications at every stage
```

Both are idempotent: a re-run updates roles and names but leaves edits made in dev alone. `seed.ts` refuses to run
with `APP_ENV=production`, and `seed-applications.ts` runs only with `APP_ENV=dev`.

## Signing in as staff

Back-office roles must use two-step verification (FR-ACC-004). The first time you sign in as staff:

1. Sign in with the email and password.
2. Choose **Use code** and then **Verify**. In dev mode (`APP_ENV=dev`) no email is sent: the code appears on screen.
3. The portal asks you to set up two-step verification. Choose **Email**.

Applicants sign in with the password alone.

## The validation chain

| #   | Step                                        | Who                                        | Account                   | Roles                                   | Where                                        |
| --- | ------------------------------------------- | ------------------------------------------ | ------------------------- | --------------------------------------- | -------------------------------------------- |
| 1   | Fill in, sign and pay the application       | Applicant: Aline Uwase                     | `applicant@demo.rebp.rw`  | Applicant                               | Portal → Applications                        |
| 1   | Same, already licensed (renewal window)     | Applicant: Jean Bosco Habyarimana          | `agent@demo.rebp.rw`      | Applicant                               | Portal → Licences                            |
| 1   | Apply as a firm (REBF)                      | Firm: Keza Realty Ltd (rep. Patrick Nkusi) | `firm@demo.rebp.rw`       | Applicant, Firm admin (organisation)    | Portal → Firm                                |
| 2   | Confirm supervision (Section F)             | Supervisor: Eric Mugisha                   | `supervisor@demo.rebp.rw` | Applicant, Supervisor                   | Portal → Confirmations                       |
| 2   | Confirm affiliation (Section G)             | Principal Broker: Grace Ingabire           | `principal@demo.rebp.rw`  | Applicant, Principal Broker, Firm admin | Portal → Confirmations                       |
| 3   | Confirm or waive payments                   | Finance officer: Claudine Uwimana          | `finance@demo.rebp.rw`    | Finance officer                         | Back office → Finance                        |
| 4   | Review (Section L): documents, checks, sign | Reviewing officer: Jean Habimana           | `officer@demo.rebp.rw`    | Reviewing officer                       | Back office → Work queue                     |
| 4   | Review (second officer, for handovers)      | Reviewing officer: Alice Mukandayisenga    | `officer2@demo.rebp.rw`   | Reviewing officer                       | Back office → Work queue                     |
| 5   | Decide (Section M); approve revocations     | Approving authority: Diane Mukamana        | `approver@demo.rebp.rw`   | Approving authority                     | Back office → Decisions                      |
| 6   | Keep the register: suspend, lift, reissue   | Registrar: Olivier Niyonsaba               | `registrar@demo.rebp.rw`  | Registrar                               | Back office → Register                       |
| —   | Access control and configuration            | System administrator: Samuel Kagame        | `admin@demo.rebp.rw`      | System administrator                    | Back office → Access control / Configuration |
| —   | Read-only oversight                         | Auditor: Joyce Mutoni                      | `auditor@demo.rebp.rw`    | Auditor                                 | Back office → Audit trail                    |

**Segregation of duties (BR-091).** Whoever reviewed a file, or was ever assigned it, can't decide it. Sign the
review as `officer@`, then decide it as `approver@`.

## Applications at every stage

`seed-applications.ts` creates applicants named `<category>.<nn>@seed.rebp.rw` (same password). The categories are
`rea`, `associate-broker`, `broker`, `managing-broker`, `principal-broker`, `rebf`, `rera` and `fsla`. Each
applicant holds several applications, and each block of four applicants has one application at each stage. With
`SEED_APPLICATIONS_PER_STATUS=4`, the Real Estate Agent (`rea`) accounts are:

| Stage                               | Applicant accounts  | Who acts next                     |
| ----------------------------------- | ------------------- | --------------------------------- |
| Draft                               | `rea.01` … `rea.04` | The applicant                     |
| Pending payment                     | `rea.05` … `rea.08` | The applicant, or Finance         |
| Pending confirmations               | `rea.09` … `rea.12` | The supervisor / Principal Broker |
| Submitted                           | `rea.13` … `rea.16` | A reviewing officer (assign)      |
| Under review                        | `rea.17` … `rea.20` | The assigned officer              |
| Action required                     | `rea.21` … `rea.24` | The applicant (answer request)    |
| Further assessment                  | `rea.25` … `rea.28` | The officer                       |
| Pending decision                    | `rea.29` … `rea.32` | The approving authority           |
| Deferred                            | `rea.33` … `rea.36` | The applicant                     |
| Approved / with conditions / issued | `rea.37` … `rea.48` | The registrar (register)          |

Other categories follow the same numbering. The seeded files under review are assigned to `officer@`; assign
some to `officer2@` from the work queue to try a handover.
