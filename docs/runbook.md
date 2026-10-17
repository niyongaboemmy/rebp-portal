# Runbook — REBP Portal pilot

## Start

```bash
pnpm install
cp apps/web/.env.example apps/web/.env      # fill AUTH_SECRET, APP_ENCRYPTION_KEY (openssl rand -base64 32)
pnpm db:migrate                              # or: pnpm --filter @rebp/web db:deploy on servers
pnpm db:seed                                 # demo users, admin divisions, synthetic register
pnpm build && pnpm --filter @rebp/web start  # production; `pnpm dev` for development
```

Health: `GET /api/health` → `{"status":"ok","db":"up"}`.

## Demo script (FSLA happy path, ~10 minutes)

All demo passwords: `Rebp-Demo-Pilot-2026`. Staff and Principal Brokers sign in with two-step; in
`APP_ENV=dev` the code is shown on screen ("Use code").

1. **applicant@demo.rebp.rw** → Applications → New → _Field Sales and Leasing Agent_ → fill the steps
   (firm: type "Keza", supervisor licence `BRK-2022-00104`) → upload documents → Review and sign → code →
   pay with mobile money → _Approve payment_ in the sandbox.
2. **supervisor@demo.rebp.rw** and **principal@demo.rebp.rw** → Confirmations → Confirm.
3. **officer@demo.rebp.rw** → Back office → Work queue → open the application → Start review → record the
   checks → Approve → Sign review (password).
4. **approver@demo.rebp.rw** → Decisions → open → Approved → password → Sign decision.
5. Applicant → Licence wallet → download the certificate; scan its QR or open `/check/<licence number>`.
6. **registrar@demo.rebp.rw** → Register → find the licence → Suspend → the public page shows "Suspended".

Renewal demo: **agent@demo.rebp.rw** holds `FSL-2024-00105`, which is inside its renewal window
(and has 2 y 5 m of FSLA experience — an REA application shows the "eligible from" date).

## Scheduled jobs

`POST /api/jobs/run` with `Authorization: Bearer $CRON_SECRET` runs: renewal reminders (90/60/30/14/7 days),
expiry (a timely renewal keeps the licence active), grace → lapse, draft expiry, confirmation reminders and
expiry, payment reconciliation, licence-issuance retries, SLA warnings and upgrade nudges. Schedule it hourly:

```cron
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/run
```

Without `CRON_SECRET` the endpoint refuses all calls. In dev mode an administrator can also use
Configuration → Scheduled jobs → Run now.

## Payments (sandbox)

`PAYMENT_PROVIDER=mock`: checkout happens on `/pay/<reference>`; outcomes are delivered as HMAC-signed
webhooks to `POST /api/payments/webhook` (header `x-rebp-signature: sha256=<hex>`), idempotent by event id.
Set `PAYMENT_WEBHOOK_SECRET` when a real gateway is connected.

## Documents

Encrypted blobs live under `STORAGE_DIR` (default `apps/web/var/storage`, git-ignored), one AES-256-GCM
envelope per file, key derived from `APP_ENCRYPTION_KEY`. **Rotating `APP_ENCRYPTION_KEY` makes existing
blobs and TOTP secrets unreadable** — re-encrypt before rotating (R2 tooling).

## Backup and restore

```bash
pg_dump -Fc "$DATABASE_URL" > rebp-$(date +%F).dump
tar czf storage-$(date +%F).tgz -C apps/web var/storage
# restore
pg_restore --clean --if-exists -d "$DATABASE_URL" rebp-YYYY-MM-DD.dump
tar xzf storage-YYYY-MM-DD.tgz -C apps/web
```

Audit and licence-event tables are append-only (triggers); a restore replaces them wholesale, which is
expected. After a restore, verify the audit chain from Back office → Audit (chain status).

## Secrets

`AUTH_SECRET` (cookies, OTP hashing, certificate seal), `APP_ENCRYPTION_KEY` (TOTP secrets, documents),
`CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET`, SMTP credentials. Keep them out of the repository (`.env` only).
Rotating `AUTH_SECRET` signs everyone out and changes certificate seals (reissue certificates afterwards).

## Tests

```bash
pnpm lint && pnpm typecheck && pnpm test     # 563 unit + integration tests (uses rebp_test)
pnpm build && pnpm test:e2e                  # Playwright; E2E_PORT=<port> to target another server
```
