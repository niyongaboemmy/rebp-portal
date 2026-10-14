# REBP Portal — engineering guide

Registration, licensing and public register for Real Estate Brokerage Practitioners (form REBP–REG–01).
Requirements: [docs/SRS.md](docs/SRS.md). Delivery plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Decisions: [docs/adr/](docs/adr/).

## Layout

```
apps/web/                Next.js 16 (App Router) — UI and server (server actions, route handlers)
  src/app/               Routes: (public) (auth) (portal) (backoffice) api/ dev/
  src/components/ui/     Design-system primitives (shadcn-style on Radix)
  src/components/layout/ Shells, navigation, header/footer, theme + language switchers
  src/config/            Navigation (role-filtered)
  src/hooks/             useActionForm, useErrorMessage, useCountdown, useMediaQuery…
  src/server/            Server-only domain code: auth/, access/, audit/, notifications/, db, env, action wrapper
  src/server/actions/    "use server" entry points — thin: validate, rate-limit, call the domain, map errors
  messages/              i18n catalogues (en complete; rw/fr drafts)
  prisma/                Schema, migrations, seed
  e2e/                   Playwright specs (+ axe)
packages/contracts/      Shared Zod schemas, enums, RBAC matrix — the single source of truth
infra/                   docker-compose (postgres, redis, mailpit)
```

## Commands

```bash
pnpm dev                 # web on :3000
pnpm lint | typecheck | test | build
pnpm test:e2e            # Playwright on :3100 against rebp_test
pnpm db:migrate          # prisma migrate dev (apps/web)
pnpm db:seed             # demo users for every role
```

## Conventions

- **Cite SRS IDs** in code comments, commits and PRs (`feat(auth): FR-ACC-004 TOTP enrolment`).
- **Contracts first.** Input schemas live in `@rebp/contracts`; client forms and server actions parse the same schema.
- **Errors are i18n keys.** Throw `AppError("code")` → message `errors.code`; Zod messages are `validation.*` keys.
  Server actions return `ActionResult` via `runAction()`; clients use `useActionForm()`.
- **All user-facing strings go through next-intl.** Add keys to `messages/en.json`.
- **Guards on every page.** Layouts don't re-run on client navigation: each page calls `requireUser()` /
  `requireCapability()`. `proxy.ts` is only an optimistic cookie check.
- **Never pass functions or icon components from a Server Component to a Client Component.** Client
  components that need nav config import it themselves.
- **Authorise by capability, not role name.** Pages: `requireCapability()`. Server actions: `authorizeAction()`
  (re-checks capability, MFA and optional step-up — actions are public endpoints). Navigation filters by effective
  capabilities, so matrix edits take effect everywhere. Access rules live in `@rebp/contracts` (`validateMatrix`).
- **Dev mode (`APP_ENV=dev`)**: codes are simulated and shown via `<DevCode>`; read them with `devCodeFor()`. Never return
  a code to the browser any other way.
- **Forms validate on submit, then on change** (`useActionForm`). Don't reintroduce blur validation on short forms: it
  shifts the layout under the pointer. Hide transient UI with `invisible`, not only `opacity-0`.
- **Audit every state change** with `recordAudit()`; mask PII with `maskEmail` / `maskPhone`.
- Server-only modules import `"server-only"`; never import `src/server/**` from client code except `actions/`.

## Never

- Log passwords, codes, tokens or PII. No secrets in the repo (`.env.example` only).
- Write to the DB outside `src/server/**`. Update or delete `AuditEvent` rows (a trigger blocks it).
- Auto-merge a Google identity into an existing password account.
- Relax `minimumReleaseAge` or add packages to `allowBuilds` without review.
