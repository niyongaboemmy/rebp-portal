# REBP Portal

Online registration, licensing and public register for Real Estate Brokerage Practitioners and Brokerage Firms (form **REBP–REG–01**).

- [Software Requirements Specification](docs/SRS.md) · [Implementation plan](docs/IMPLEMENTATION_PLAN.md) · [ADRs](docs/adr/) · [Decision log](docs/decisions.md) · [Engineering guide](CLAUDE.md)

## Stack

Next.js 16 (App Router, React 19, Turbopack) · TypeScript 5.9 · Tailwind CSS 4 + Radix · React Hook Form + Zod 4 ·
TanStack Query · next-intl · Prisma 7 + PostgreSQL · Vitest · Playwright + axe · pnpm 11 + Turborepo.

## Getting started

Requirements: Node 24 (`.nvmrc`), pnpm 11, PostgreSQL 16+ (local install or `docker compose -f infra/docker-compose.yml up -d`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env          # then set DATABASE_URL and generate the two keys
createdb rebp_dev && createdb rebp_test         # skip if using docker compose
pnpm db:migrate && pnpm db:seed
pnpm dev                                        # http://localhost:3000
```

For tests, create `apps/web/.env.test` pointing at `rebp_test` (see `.github/workflows/ci.yml` for the variables).

## Authentication

Users choose how they sign in from **Security settings**:

- **Email + password** (argon2id, breached-password check, lockout).
- **Google** (OIDC with PKCE). Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; redirect URI `${APP_URL}/api/auth/google/callback`. Without them the button is disabled.
- **Two-step verification** with any mix of **authenticator app**, **SMS** and **email** codes, a preferred method, and recovery codes. Mandatory for staff and Principal Brokers.

Email and phone must be verified after sign-up.

### Dev mode — simulated email and SMS

Until the mail/SMS gateway is connected, keep `APP_ENV=dev` (the default outside a production build). Every screen
that asks for a code shows it on screen with a **Use code** button, and all messages are listed at `/dev/outbox`. Set
`APP_ENV=staging` or `production` once real delivery is configured: codes are then never stored or shown.

## Access control (RBAC)

- **Back office → Access control** (`/backoffice/access`): search and filter people, open a person to toggle roles with a
  live preview of the permissions gained or lost, and disable/re-enable accounts. The **Roles & permissions** tab is an
  interactive matrix (role × capability) with draft changes, a review step and reset-to-defaults.
- Guard-rails are enforced on the server: segregation of duties, maker-checker, no admin lock-out, staff-only powers,
  no editing your own access, at least one active admin. All changes need step-up re-authentication and are audited.
- **Settings → My access** (`/settings/access`) shows every user their roles and effective permissions.
- System administrators manage people and the matrix; auditors have a read-only view. See [ADR-009](docs/adr/ADR-009-access-control.md).

### Demo accounts (seed)

Password for all: `Rebp-Demo-Pilot-2026`. Staff accounts must set up two-step on first sign-in.

| Email                   | Roles                        |
| ----------------------- | ---------------------------- |
| applicant@demo.rebp.rw  | Applicant                    |
| supervisor@demo.rebp.rw | Applicant, Supervisor        |
| principal@demo.rebp.rw  | Principal Broker, Firm admin |
| officer@demo.rebp.rw    | Reviewing Officer            |
| approver@demo.rebp.rw   | Approving Authority          |
| registrar@demo.rebp.rw  | Registrar                    |
| finance@demo.rebp.rw    | Finance Officer              |
| admin@demo.rebp.rw      | System administrator         |
| auditor@demo.rebp.rw    | Auditor / DPO                |

## Quality gates

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

CI runs the same steps plus a dependency audit (`.github/workflows/ci.yml`).

## Status

Foundation (Plan D1: WP-0.2, 0.3, 0.4, 0.7, 0.8, 0.9, 0.10, 0.11) is in place: monorepo, design system, navigation,
i18n, authentication with MFA and Google, simulated OTP delivery (dev mode), RBAC with an access-control console, audit trail, CI. Application, review and licensing modules follow the plan from D2.
