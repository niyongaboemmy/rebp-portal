# ADR-012 — Pilot hosting on cPanel shared hosting, deployed from main by GitHub Actions

**Status:** Accepted · **Refs:** NFR-MNT-005, FR-REG-002, FR-DOC-008, SEC-002 · **Runbook:**
[DEPLOYMENT](../DEPLOYMENT.md)

**Problem.** The pilot needs a public production environment at `https://rireb.irebpmr.rw`. The host already
available is a Namecheap cPanel account (CloudLinux, LiteSpeed + Passenger, Node via "Setup Node.js App",
PostgreSQL **10**). It shares an inode cap with other sites, its firewall blocks bursts of SSH logins, and it has
no Docker, Redis or root access.

**Decision.**

- **Build in CI, run on cPanel.** GitHub Actions builds a Next.js `output: "standalone"` release (about 2,700
  files) and uploads it over one SSH login. Nothing is installed or compiled on the server.
  `releases/<id>` plus a `current` symlink give atomic switches and instant rollback; two releases are kept.
- **Main only.** CI deploys a push to `main` once `verify` (format, lint, types, tests, build, E2E) and
  `postgres10` pass. Manual runs can redeploy or roll back, but only to commits on `main`. The `production`
  environment is restricted to `main`.
- **Flat `node_modules` for releases.** The server's Node preserves symlinked paths. Under pnpm's symlinked layout
  that resolves `pg-types` to the wrong `postgres-array`, and every database page fails. Release builds install
  with `nodeLinker: hoisted`, so the trace is made of real folders. Development keeps pnpm's default.
- **Our own migrator** (`deploy/cpanel/migrate.cjs`) instead of the Prisma CLI. The CLI's native schema engine
  costs thousands of files. The migrator applies `prisma/migrations` and records them in `_prisma_migrations`
  exactly like `prisma migrate deploy` does: same checksum and same advisory lock, so the CLI stays usable. It
  runs before the switch, one transaction per migration, so a failure leaves both schema and site unchanged.
- **PostgreSQL 10 compatibility without editing migrations.** The migrator makes two syntax-only adjustments in
  memory, gated on the server version:
  - `EXECUTE FUNCTION` becomes `EXECUTE PROCEDURE` (before 11).
  - `ALTER TYPE … ADD VALUE` runs on its own, outside the transaction (before 12).

  Committed migration files and their checksums stay as they are. The `postgres10` CI job applies every
  migration on PostgreSQL 10 so a new incompatibility fails the PR, not the deploy.

- **`pg_trgm` is a host prerequisite.** On PostgreSQL 10 only a superuser can create it, and register search
  (ADR-006) needs `word_similarity`. Until it exists, the deploy stops at the migration step with an actionable
  message.
- **No demo data in production.** The first deploy creates one `SYSTEM_ADMIN` from `BOOTSTRAP_ADMIN_EMAIL`, with a
  random password written to a mode-600 file on the server and never logged. That admin enrols two-step
  verification at first sign-in.
- **State outside releases.** Encrypted documents live in `shared/storage` (`STORAGE_DIR`). The env file
  (`.env.production`, mode 600) exists only on the server. A `pg_dump` runs before every deploy, and the last 7
  are kept.
- **Scheduler.** One hourly cron entry calls `POST /api/jobs/run` with `CRON_SECRET`.

**Consequences.**

- Rate limiting stays in memory (SEC-006). Passenger may run several processes, so budgets are per process.
  That's acceptable for the pilot; Redis comes with a move off shared hosting.
- Each deploy takes about 15 minutes, and E2E gates it. A red `main` doesn't deploy.
- Moving to a VPS or a managed platform reuses the standalone release. Only `activate.sh` and the env location
  change.
- PostgreSQL 10 is past end of life. Ask the host for a newer server (or use a managed database) before
  real-user launch. The migrator's adjustments then switch off by themselves.
