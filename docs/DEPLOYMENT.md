# Production deployment — https://rireb.irebpmr.rw

The REBP Portal runs on the Namecheap cPanel account. Releases are built and deployed by GitHub Actions on every
merge to `main`. Decision record: [ADR-012](adr/ADR-012-cpanel-hosting.md). There are no secrets in this file:
credentials go in `docs/DEPLOYMENT.private.md`, which is git-ignored and must never be committed.

## 1. How a merge reaches production

```
merge to main ─► CI (ci.yml)
                  ├─ verify: format · lint · typecheck · unit+integration · build · audit · E2E
                  └─ postgres10: every migration applied on PostgreSQL 10 by the deploy's migrator
                       both green ─► Deploy (deploy.yml)
                         Build release   flat node_modules → migrate PG10 → standalone build → bundle.sh
                                         → smoke test (app.cjs, symlinks preserved, health + pages + admin bootstrap)
                         Deploy          one SSH login: upload → activate.sh
                                         pg_dump → migrate.cjs → create-admin.cjs → switch `current`
                                         → restart Passenger → wait for "db":"up" → auto-rollback if unhealthy
```

- Only the newest commit on `main` deploys, one deploy at a time.
- **Redeploy or roll back:** Actions → _Deploy (cPanel)_ → Run workflow → a SHA on `main`.
- A failed migration stops the deploy **before** the switch. Each migration runs in one transaction, so the
  site and schema stay as they were.

## 2. Server layout

```
~/apps/rireb/
├── app.cjs              Passenger startup file (copied from each release)
├── .env.production      all runtime secrets (chmod 600), created by server-setup.sh
├── admin-credentials.txt  first administrator (created once; delete after first sign-in)
├── current -> releases/<yyyymmddhhmmss>-<sha>
├── releases/            last 2 releases (~2,700 files each)
├── shared/storage/      encrypted documents (STORAGE_DIR, FR-DOC-008); survives deploys
├── backups/             db-<time>-<release>.dump before each deploy (last 7)
├── logs/                node.log (app), cron.log, acme.log
└── tmp/restart.txt      touch to restart
~/rireb.irebpmr.rw/.htaccess   HTTPS redirect + the CloudLinux Passenger block (don't edit that block)
~/nodevenv/apps/rireb/22/      Node virtualenv created by cPanel (never "Run NPM Install")
```

## 3. One-time setup

1. **Domain.** cPanel → Domains → Create: `rireb.irebpmr.rw`, document root `rireb.irebpmr.rw`, do not share
   the root. `server-setup.sh` creates it as a subdomain if it is missing.
2. **Deploy key** for GitHub Actions (on your computer):
   ```bash
   ssh-keygen -t ed25519 -C github-deploy-rebp -f rebp_deploy -N ""
   gh secret set CPANEL_SSH_KEY -R niyongaboemmy/rebp-portal < rebp_deploy
   ```
3. **Provision the server.** One SSH login runs every step. It is idempotent, so you can run it again after a fix:

   ```bash
   ssh -i ~/.ssh/cpanel_deploy -p 21098 uruzjktk@premium231.web-hosting.com \
     "DEPLOY_PUBKEY='$(cat rebp_deploy.pub)' BOOTSTRAP_ADMIN_EMAIL=<admin email> MAIL_DOMAIN=irebpmr.rw bash -s" \
     < deploy/cpanel/server-setup.sh
   rm rebp_deploy rebp_deploy.pub
   ```

   It covers:
   - the domain
   - the PostgreSQL database and user (`uruzjktk_rireb` / `uruzjktk_rirebapp`)
   - a `pg_trgm` check
   - the `noreply@irebpmr.rw` SMTP mailbox
   - `.env.production` with fresh secrets
   - the Node.js app (Node 22, startup `app.cjs`)
   - the HTTPS redirect
   - the deploy key
   - the hourly cron
   - the Let's Encrypt certificate

   Read its summary and fix every warning before the first deploy.

4. **<a id="pg_trgm"></a>pg_trgm.** The host's database user can't create it (PostgreSQL 10 needs a
   superuser). The migrator then installs a plain-SQL `word_similarity(text, text)` instead: it agrees with
   pg_trgm on exact and typo matches, but there's no trigram index, so search scans the register. That's fine at
   pilot size. To switch to the real extension later (for example after a Namecheap ticket):
   `DROP FUNCTION word_similarity(text, text), rebp_trgm(text[]), rebp_trgm_words(text);` then, as superuser,
   `CREATE EXTENSION pg_trgm;` and
   `CREATE INDEX "RegisterEntry_searchText_trgm" ON "RegisterEntry" USING gin ("searchText" gin_trgm_ops);`.
   A future migration that uses other pg_trgm features fails with a pointer here.
5. **GitHub** (Settings → Secrets and variables → Actions, or `gh`):

   | Secret                   | Value                                                                     |
   | ------------------------ | ------------------------------------------------------------------------- |
   | `CPANEL_SSH_HOST`        | `premium231.web-hosting.com`                                              |
   | `CPANEL_SSH_PORT`        | `21098`                                                                   |
   | `CPANEL_SSH_USER`        | the cPanel user                                                           |
   | `CPANEL_SSH_KEY`         | private half of `github-deploy-rebp` (step 2)                             |
   | `CPANEL_SSH_KNOWN_HOSTS` | `ssh-keyscan -p 21098 premium231.web-hosting.com` (check the fingerprint) |

   | Variable         | Value                       |
   | ---------------- | --------------------------- |
   | `APP_URL`        | `https://rireb.irebpmr.rw`  |
   | `CPANEL_APP_DIR` | `apps/rireb`                |
   | `NODE_VERSION`   | `22` (match the cPanel app) |

   Environment **`production`**: deployment branches limited to `main`. Optionally add required reviewers.

6. **First deploy.** Actions → _Deploy (cPanel)_ → Run workflow → `main`. Later merges deploy automatically.
7. **First sign-in.** `cat ~/apps/rireb/admin-credentials.txt`, then:
   1. Sign in at `/sign-in` and enrol two-step verification.
   2. Change the password, then delete the file.
   3. Grant staff roles from Back office → Access.

## 4. Everyday operations

| Task              | How                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy            | Merge to `main` (about 15 min end to end; watch Actions)                                                                                |
| Roll back         | Actions → Deploy (cPanel) → older SHA; or on the server: `ln -sfn releases/<prev> current && touch tmp/restart.txt`                     |
| Restart           | `pkill -u $USER -f '^lsnode:/home/uruzjktk/apps/rireb/'` (LiteSpeed ignores `tmp/restart.txt` here); the next request starts it         |
| Health            | `https://rireb.irebpmr.rw/api/health` → `"db":"up"`                                                                                     |
| Logs              | `~/apps/rireb/logs/node.log`, `cron.log`; `stderr.log` in the app root                                                                  |
| Edit env          | `nano ~/apps/rireb/.env.production`, then restart. **Never change** `AUTH_SECRET` or `APP_ENCRYPTION_KEY` (docs/runbook.md, Secrets)    |
| Schema change     | `prisma migrate dev --create-only` locally, commit `prisma/migrations`, merge. CI checks it on PostgreSQL 10                            |
| DB shell          | `ssh -p 21098 -L 6543:127.0.0.1:5432 <user>@<host>`, then `psql postgres://<db user>:<pw>@127.0.0.1:6543/uruzjktk_rireb`                |
| Restore DB        | Stop the app (cPanel → Setup Node.js App), `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/<file>.dump`, start it |
| Back up documents | `tar czf storage-$(date +%F).tgz -C ~/apps/rireb/shared storage` (they are encrypted with `APP_ENCRYPTION_KEY`; keep both)              |

**SSH firewall:** about three logins in quick succession block your IP for 10–15 minutes. Batch commands into
one login.

## 5. Troubleshooting

| Symptom                                                        | Cause / fix                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| CI jobs fail in seconds, "recent account payments have failed" | GitHub billing for private-repo Actions minutes: fix it under Settings → Billing                                    |
| Deploy stops at `[migrate] FAILED … pg_trgm`                   | §3 step 4                                                                                                           |
| `[migrate] FAILED: Unfinished migration(s)`                    | A migration was interrupted outside a transaction. Fix by hand, then `prisma migrate resolve` through the DB tunnel |
| Every page 500, `Cannot find module …` in node.log             | The release wasn't built with `nodeLinker: hoisted` (bundle.sh refuses such builds)                                 |
| Every page 500, "Failed to proxy http://localhost…"            | `HOSTNAME` must be `localhost` (set by app.cjs)                                                                     |
| Deploy rolled back, "not healthy after 3 minutes"              | `tail ~/apps/rireb/logs/node.log`. Usually `Invalid environment configuration` (check the env file)                 |
| Codes never arrive by email                                    | `SMTP_*` empty in the env file: emails are only logged. Set them (or `MAIL_DOMAIN` in setup)                        |
| Health check fails on the first deploy only                    | TLS isn't issued yet (`logs/acme.log`). Use cPanel → SSL/TLS Status → Run AutoSSL                                   |
