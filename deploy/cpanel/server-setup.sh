#!/usr/bin/env bash
# One-time provisioning of the REBP Portal on the cPanel account (docs/DEPLOYMENT.md §3, ADR-012).
# Idempotent: every step checks first, so it is safe to run again after fixing a failed step.
# Run it in ONE SSH login (the server's firewall blocks bursts of logins):
#
#   ssh -p 21098 <user>@<host> "DEPLOY_PUBKEY='ssh-ed25519 AAAA… github-deploy-rebp' \
#     BOOTSTRAP_ADMIN_EMAIL=admin@irebpmr.rw bash -s" < deploy/cpanel/server-setup.sh
#
# Never prints a secret: generated values go straight into the env file (chmod 600).
set -uo pipefail

DOMAIN="${DOMAIN:-rireb.irebpmr.rw}"
APP_NAME="${APP_NAME:-rireb}"
APP_REL="apps/$APP_NAME"
APP="$HOME/$APP_REL"
DOCROOT="${DOCROOT:-$HOME/$DOMAIN}"
NODE_VERSION="${NODE_VERSION:-22}"
CPUSER="$(whoami)"
DB_NAME="${DB_NAME:-${CPUSER}_${APP_NAME}}"
DB_USER="${DB_USER:-${CPUSER}_${APP_NAME}app}" # cPanel refuses a user named like the database
APP_ENV_VALUE="${APP_ENV:-production}"
MAIL_DOMAIN="${MAIL_DOMAIN:-}"                # e.g. irebpmr.rw: creates noreply@ for SMTP
ENV_FILE="$APP/.env.production"
CRON_LINE="0 * * * * /bin/bash \$HOME/$APP_REL/current/deploy/cron.sh >/dev/null 2>&1"

ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; WARNINGS=$((WARNINGS + 1)); }
step() { printf '\n== %s\n' "$*"; }
WARNINGS=0
umask 077
mkdir -p "$APP/shared/storage" "$APP/releases" "$APP/logs" "$APP/backups" "$APP/tmp"

step "1. Domain $DOMAIN"
if uapi --output=json DomainInfo single_domain_data domain="$DOMAIN" | grep -q '"status":1'; then
  ok "exists"
else
  parent="${DOMAIN#*.}"
  if uapi --output=json SubDomain addsubdomain domain="${DOMAIN%%.*}" rootdomain="$parent" \
    dir="${DOCROOT#"$HOME"/}" | grep -q '"status":1'; then
    ok "created as a subdomain of $parent (document root $DOCROOT)"
  else
    warn "could not create it: add it in cPanel → Domains (document root $DOCROOT), then run again"
  fi
fi
(umask 022 && mkdir -p "$DOCROOT")

step "2. PostgreSQL database $DB_NAME"
if [ -f "$ENV_FILE" ] && grep -q '^DATABASE_URL=postgres' "$ENV_FILE"; then
  ok "already configured in $ENV_FILE"
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  uapi --output=json Postgresql list_databases | grep -q "\"$DB_NAME\"" ||
    uapi Postgresql create_database name="$DB_NAME" >/dev/null
  if uapi --output=json Postgresql list_users | grep -q "\"$DB_USER\""; then
    uapi Postgresql set_password user="$DB_USER" password="$DB_PASSWORD" >/dev/null
  else
    uapi Postgresql create_user name="$DB_USER" password="$DB_PASSWORD" >/dev/null
  fi
  uapi Postgresql grant_all_privileges user="$DB_USER" database="$DB_NAME" >/dev/null
  DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
  if psql "$DATABASE_URL" -Atc 'select 1' >/dev/null 2>&1; then ok "created; user $DB_USER can connect"
  else warn "created, but $DB_USER cannot connect yet (check cPanel → PostgreSQL Databases)"; fi
fi
psql "$DATABASE_URL" -Atc 'show server_version' 2>/dev/null | sed 's/^/  PostgreSQL /'

step "3. pg_trgm extension (register search, FR-REG-002)"
if psql "$DATABASE_URL" -Atc "CREATE EXTENSION IF NOT EXISTS pg_trgm" >/dev/null 2>&1; then
  ok "available"
else
  warn "the database user cannot create pg_trgm. Ask Namecheap support to run, as a superuser:"
  printf '      CREATE EXTENSION pg_trgm;   -- in database %s\n' "$DB_NAME"
  warn "deploys stop at the migration step until it exists"
fi

step "4. SMTP mailbox"
SMTP_LINES="SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=\"REBP Portal <no-reply@${MAIL_DOMAIN:-$DOMAIN}>\""
if [ -f "$ENV_FILE" ]; then
  ok "left as configured in $ENV_FILE"
elif [ -n "$MAIL_DOMAIN" ]; then
  MAIL_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  if uapi --output=json Email list_pops | grep -q "\"noreply@$MAIL_DOMAIN\""; then
    uapi Email passwd_pop email=noreply domain="$MAIL_DOMAIN" password="$MAIL_PASSWORD" >/dev/null
  else
    uapi Email add_pop email=noreply domain="$MAIL_DOMAIN" password="$MAIL_PASSWORD" quota=250 >/dev/null
  fi
  SMTP_LINES="SMTP_HOST=$(hostname -f)
SMTP_PORT=465
SMTP_USER=noreply@$MAIL_DOMAIN
SMTP_PASSWORD=$MAIL_PASSWORD
SMTP_FROM=\"REBP Portal <noreply@$MAIL_DOMAIN>\""
  ok "noreply@$MAIL_DOMAIN ready for sending"
else
  warn "no MAIL_DOMAIN given: emails are only logged until SMTP_* is set in $ENV_FILE"
fi

step "5. Environment file $ENV_FILE"
if [ -f "$ENV_FILE" ]; then
  ok "exists; not touched (AUTH_SECRET and APP_ENCRYPTION_KEY must never change after launch)"
else
  cat >"$ENV_FILE" <<EOF
# Runtime settings for https://$DOMAIN (docs/DEPLOYMENT.md). Keep this file private (chmod 600).
# After editing: touch $APP/tmp/restart.txt

APP_URL=https://$DOMAIN
# dev | staging | production. "dev" shows one-time codes on screen: never with real users.
APP_ENV=$APP_ENV_VALUE
DATABASE_URL=$DATABASE_URL

# --- Generated: never change after launch (sessions, TOTP secrets, encrypted documents) ---
AUTH_SECRET=$(openssl rand -base64 32)
APP_ENCRYPTION_KEY=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -hex 32)
PAYMENT_WEBHOOK_SECRET=$(openssl rand -hex 32)

# --- Documents (FR-DOC-008): outside the releases, survives deploys ---
STORAGE_DIR=$APP/shared/storage

# --- Email ---
$SMTP_LINES

# --- Adapters (ADR-005) ---
SMS_PROVIDER=mock
PAYMENT_PROVIDER=mock
AUTH_BREACHED_PASSWORD_CHECK=true

# --- Google sign-in (optional). Redirect URI: https://$DOMAIN/api/auth/google/callback ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- First deploy: creates this system administrator; password in $APP/admin-credentials.txt ---
BOOTSTRAP_ADMIN_EMAIL=${BOOTSTRAP_ADMIN_EMAIL:-}
BOOTSTRAP_ADMIN_NAME="${BOOTSTRAP_ADMIN_NAME:-System administrator}"
EOF
  chmod 600 "$ENV_FILE"
  ok "created with fresh secrets"
fi
[ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ] || grep -q '^BOOTSTRAP_ADMIN_EMAIL=.' "$ENV_FILE" ||
  warn "BOOTSTRAP_ADMIN_EMAIL is empty: no administrator will be created on the first deploy"

step "6. Node.js app (Passenger, Node $NODE_VERSION)"
if cloudlinux-selector get --json --interpreter nodejs 2>/dev/null | grep -q "\"$APP_REL\""; then
  ok "exists"
else
  if cloudlinux-selector create --json --interpreter nodejs --version "$NODE_VERSION" \
    --app-root "$APP_REL" --domain "$DOMAIN" --app-uri / --app-mode production \
    --startup-file app.cjs --passenger-log-file "$APP/logs/node.log" | grep -q '"result": *"success"'; then
    ok "created"
  else
    warn "cloudlinux-selector create failed: create it in cPanel → Setup Node.js App (root $APP_REL, startup app.cjs)"
  fi
fi
rm -rf "$APP/public" 2>/dev/null || true # placeholder created by cPanel; unused

step "7. HTTPS redirect in $DOCROOT/.htaccess"
HT="$DOCROOT/.htaccess"
if grep -q 'RewriteCond %{HTTPS} !=on' "$HT" 2>/dev/null; then
  ok "present"
else
  { printf '%s\n' 'RewriteEngine On' 'RewriteCond %{HTTPS} !=on' \
      'RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]'
    cat "$HT" 2>/dev/null || true; } >"$HT.new" && mv "$HT.new" "$HT" && chmod 644 "$HT"
  ok "added above the Passenger block"
fi

step "8. GitHub Actions deploy key"
if [ -n "${DEPLOY_PUBKEY:-}" ]; then
  install -d -m 700 "$HOME/.ssh"
  touch "$HOME/.ssh/authorized_keys" && chmod 600 "$HOME/.ssh/authorized_keys"
  key_body="$(printf '%s' "$DEPLOY_PUBKEY" | awk '{print $2}')"
  if grep -qF "$key_body" "$HOME/.ssh/authorized_keys"; then ok "already authorised"
  else printf '%s\n' "$DEPLOY_PUBKEY" >>"$HOME/.ssh/authorized_keys"; ok "authorised"; fi
else
  warn "no DEPLOY_PUBKEY given; skipped"
fi

step "9. Cron (scheduled jobs, hourly)"
if crontab -l 2>/dev/null | grep -qF "$APP_REL/current/deploy/cron.sh"; then
  ok "present"
else
  { crontab -l 2>/dev/null; printf '%s\n' "$CRON_LINE"; } | crontab - && ok "added: $CRON_LINE"
fi

step "10. TLS certificate (Let's Encrypt, DNS-01 through the cPanel API)"
ACME="$HOME/.acme.sh/acme.sh"
if [ ! -x "$ACME" ]; then
  warn "acme.sh not installed; use cPanel → SSL/TLS Status → Run AutoSSL instead"
elif "$ACME" --list 2>/dev/null | awk '{print $1}' | grep -qx "$DOMAIN"; then
  ok "issued already (renewed by the acme.sh cron)"
elif "$ACME" --issue --dns dns_cpanel -d "$DOMAIN" --dnssleep 90 >"$APP/logs/acme.log" 2>&1 &&
  "$ACME" --deploy -d "$DOMAIN" --deploy-hook cpanel_uapi >>"$APP/logs/acme.log" 2>&1; then
  ok "issued and installed"
else
  warn "issuing failed (see $APP/logs/acme.log); the DNS zone must be in this cPanel account"
fi

step "Summary"
printf '  App root:   %s\n  Docroot:    %s\n  Env file:   %s\n  Warnings:   %s\n' \
  "$APP" "$DOCROOT" "$ENV_FILE" "$WARNINGS"
printf '  Inodes:     %s\n' "$(quota -s 2>/dev/null | awk 'NR==3{print $5" / "$7}')"
[ "$WARNINGS" -eq 0 ] && echo "  Ready for the first deploy (Actions → Deploy (cPanel) → Run workflow)."
exit 0
