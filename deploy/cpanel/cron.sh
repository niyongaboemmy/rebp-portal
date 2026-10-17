#!/usr/bin/env bash
# The cPanel cron entry for scheduled jobs (docs/DEPLOYMENT.md, docs/runbook.md "Scheduled jobs").
# Namecheap allows at most 5 cron jobs per account, none more often than every 5 minutes.
#
#   0 * * * * /bin/bash $HOME/apps/rireb/current/deploy/cron.sh >/dev/null 2>&1
#
# Renewal reminders, expiry and lapse, draft expiry, confirmation timers, payment reconciliation,
# issuance retries and SLA warnings (POST /api/jobs/run, authorised with CRON_SECRET).
set -uo pipefail

APP="${APP_ROOT:-$HOME/apps/rireb}"
ENV_FILE="$APP/.env.production"
LOG="$APP/logs/cron.log"
env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

SITE="$(env_get APP_URL)"
SITE="${SITE%/}"
SECRET="$(env_get CRON_SECRET)"

code="$(curl -sS -m 280 -o /dev/null -w '%{http_code}' -X POST \
  -H "authorization: Bearer $SECRET" "$SITE/api/jobs/run")"
printf '%s jobs %s\n' "$(date -u +%FT%TZ)" "$code" >>"$LOG"

# Keep the log small (inodes and disk).
tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
