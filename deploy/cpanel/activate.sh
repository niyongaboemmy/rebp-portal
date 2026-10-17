#!/usr/bin/env bash
# Switches the cPanel app to an uploaded release (docs/DEPLOYMENT.md, ADR-012).
#
#   APP_ROOT=$HOME/apps/rireb bash $HOME/apps/rireb/releases/<id>/deploy/activate.sh <id>
#
# Backs up the database, applies pending migrations (stops here, unchanged, if one fails),
# bootstraps the first administrator, points `current` at the release, restarts Passenger and
# waits for /api/health. If the new release is not healthy it switches back and exits non-zero.
set -euo pipefail

ID="${1:?usage: activate.sh <release-id>}"
APP="${APP_ROOT:-$HOME/apps/rireb}"
REL="$APP/releases/$ID"
KEEP="${KEEP_RELEASES:-2}" # releases kept on disk, current included (inode budget)
KEEP_BACKUPS="${KEEP_BACKUPS:-7}"
ENV_FILE="$APP/.env.production"

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

[ -f "$REL/apps/web/server.js" ] || { log "No release at $REL"; exit 1; }
[ -f "$ENV_FILE" ] || { log "Missing $ENV_FILE (run deploy/cpanel/server-setup.sh first)"; exit 1; }
SITE="$(env_get APP_URL)"
SITE="${SITE%/}"

# The Node of the cPanel app (its virtualenv), else the newest CloudLinux Node.
NODE="${NODE_BIN:-}"
[ -n "$NODE" ] || NODE="$(ls -d "$HOME/nodevenv/${APP#"$HOME"/}"/*/bin/node 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$NODE" ] || NODE="$(ls -d /opt/alt/alt-nodejs*/root/usr/bin/node 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$NODE" ] || NODE="$(command -v node || true)"
[ -x "$NODE" ] || { log "No Node.js found (set NODE_BIN)"; exit 1; }
run_node() (
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  cd "$REL" && NODE_PRESERVE_SYMLINKS=1 "$NODE" "$@"
)

# 1. Folders outside the releases: encrypted documents, logs, backups.
mkdir -p "$APP/shared/storage" "$APP/tmp" "$APP/logs" "$APP/backups"
chmod 700 "$APP/shared" "$APP/shared/storage" "$APP/backups"

# 2. Startup file: kept in step with the release that ships it.
cp "$REL/deploy/app.cjs" "$APP/app.cjs"

# 3. Database backup before anything migrates.
DB_URL="$(env_get DATABASE_URL)"
if [ "${SKIP_DB_BACKUP:-0}" != "1" ] && command -v pg_dump >/dev/null; then
  DUMP="$APP/backups/db-$(date -u +%Y%m%d%H%M%S)-$ID.dump"
  if pg_dump --format=custom --no-owner --file="$DUMP" "$DB_URL"; then
    chmod 600 "$DUMP"
    log "Database backed up to $DUMP"
    ls -1t "$APP"/backups/db-*.dump | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f
  else
    rm -f "$DUMP"
    log "WARNING: pg_dump failed; continuing without a backup"
  fi
fi

# 4. Migrations, each in one transaction. A failure stops the deploy before the switch.
log "Node $("$NODE" --version) at $NODE"
run_node deploy/migrate.cjs prisma/migrations

# 5. First deploy only: the first administrator (credentials file on the server, never logged).
run_node deploy/create-admin.cjs "$APP/admin-credentials.txt" ||
  log "WARNING: administrator bootstrap failed; see above"

# 6. Switch `current` atomically and restart.
PREV="$(readlink "$APP/current" 2>/dev/null || true)"
switch_to() {
  ln -sfn "$1" "$APP/current.next"
  mv -Tf "$APP/current.next" "$APP/current"
  touch "$APP/tmp/restart.txt"
  if command -v cloudlinux-selector >/dev/null; then
    cloudlinux-selector restart --json --interpreter nodejs \
      --app-root "${APP#"$HOME"/}" >/dev/null 2>&1 || true
  fi
}
switch_to "$REL"
log "current -> releases/$ID (previous: ${PREV:-none})"

# 7. Health check through the public URL. Only the app's own JSON counts: an error page or
#    another site on the domain can answer 200 too.
health() { curl -fs -m 20 "$SITE/api/health" | grep -q '"db":"up"'; }
healthy=0
for _ in $(seq 1 36); do
  if health; then healthy=1; break; fi
  sleep 5
done
if [ "$healthy" != 1 ]; then
  log "Release $ID is not healthy after 3 minutes."
  tail -n 40 "$APP/logs/node.log" 2>/dev/null || true
  if [ -n "$PREV" ]; then
    switch_to "$PREV"
    log "Rolled back to $PREV. Check $APP/logs/node.log and stderr.log in the app root."
  fi
  exit 1
fi
log "Healthy: $(curl -fsS -m 20 "$SITE/api/health" || true)"
# Warm the main entry points so the first visitor doesn't pay for the cold start.
for path in / /register /check /sign-in; do curl -s -m 60 -o /dev/null "$SITE$path" || true; done

# 8. Prune old releases (each one is a few thousand files against the inode cap).
cd "$APP/releases"
{ ls -1t | grep -vx "$ID" || true; } | tail -n +"$KEEP" | xargs -r rm -rf
log "Done. Releases on disk: $(ls -1 | tr '\n' ' ')"
