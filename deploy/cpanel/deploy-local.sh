#!/usr/bin/env bash
# Deploys a commit on main from this computer, exactly as deploy.yml does, for when GitHub Actions
# is unavailable (docs/DEPLOYMENT.md §4). Builds in a throwaway worktree, so your checkout and its
# node_modules are untouched. Linux binaries (argon2, sharp) are installed next to your own.
#
#   bash deploy/cpanel/deploy-local.sh [ref]        # default: origin/main
#   DRY_RUN=/path/release.tgz bash deploy/cpanel/deploy-local.sh   # build only, keep the tarball
#   KEEP_PLATFORMS=1 DRY_RUN=…                                       # …runnable here too (tests)
set -euo pipefail

REF="${1:-origin/main}"
SSH_HOST="${CPANEL_SSH_HOST:-premium231.web-hosting.com}"
SSH_PORT="${CPANEL_SSH_PORT:-21098}"
SSH_USER="${CPANEL_SSH_USER:-uruzjktk}"
SSH_KEY="${CPANEL_SSH_KEY_FILE:-$HOME/.ssh/cpanel_deploy}"
APP_DIR="${CPANEL_APP_DIR:-apps/rireb}"
export APP_URL="${APP_URL:-https://rireb.irebpmr.rw}"

log() { printf '\n== %s\n' "$*"; }
REPO="$(git rev-parse --show-toplevel)"
git fetch -q origin
SHA="$(git rev-parse "$REF^{commit}")"
if [ -z "${DRY_RUN:-}" ]; then
  git merge-base --is-ancestor "$SHA" origin/main || { echo "$REF is not on main; only main is deployed."; exit 1; }
fi
RELEASE="$(date -u +%Y%m%d%H%M%S)-${SHA:0:8}"
TMP="$(mktemp -d)"
WORK="$TMP/src"
cleanup() { cd "$REPO"; git worktree remove --force "$WORK" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

log "Release $RELEASE"
git worktree add --detach "$WORK" "$SHA" >/dev/null
cd "$WORK"
# Flat node_modules (see deploy.yml) and the server's platform alongside this one.
cat >>pnpm-workspace.yaml <<'YAML'

nodeLinker: hoisted
supportedArchitectures:
  os: [current, linux]
  cpu: [current, x64]
  libc: [current, glibc]
YAML
pnpm install --frozen-lockfile --reporter=silent --fetch-timeout=300000 --fetch-retries=5 --network-concurrency=6

log "Build"
(
  export NEXT_OUTPUT=standalone APP_ENV=production NEXT_TELEMETRY_DISABLED=1
  export DATABASE_URL="postgresql://build@127.0.0.1:1/build"
  export AUTH_SECRET=build-only-secret-not-used-at-runtime-000000
  export APP_ENCRYPTION_KEY=build-only-key-not-used-at-runtime-0000000000
  pnpm --filter @rebp/web build
)
bash deploy/cpanel/bundle.sh "$TMP/release"
for f in "deploy/node_modules/@node-rs/argon2-linux-x64-gnu" "node_modules/@node-rs/argon2-linux-x64-gnu"; do
  [ -e "$TMP/release/$f" ] || { echo "Missing Linux binary: $f"; exit 1; }
done
# The server is linux-x64 with glibc: drop the other platforms' binaries (disk and inodes).
# KEEP_PLATFORMS=1 (with DRY_RUN) keeps them, to smoke-test the release on this computer.
[ "${KEEP_PLATFORMS:-0}" = 1 ] && [ -n "${DRY_RUN:-}" ] || find "$TMP/release" -depth -type d -path '*/node_modules/@*/*' \
  \( -name '*darwin*' -o -name '*arm64*' -o -name '*musl*' -o -name '*win32*' \) -exec rm -r {} +
COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata -czf "$TMP/release.tgz" -C "$TMP/release" .
if [ -n "${DRY_RUN:-}" ]; then
  cp "$TMP/release.tgz" "$DRY_RUN" && echo "Built $DRY_RUN ($RELEASE); nothing uploaded."
  exit 0
fi

log "Upload and activate (one SSH login)"
ssh -i "$SSH_KEY" -p "$SSH_PORT" -o BatchMode=yes -o ConnectTimeout=30 "$SSH_USER@$SSH_HOST" \
  "set -e; cd '$APP_DIR'; \
   CUR=\$(basename \"\$(readlink current 2>/dev/null || echo none)\"); \
   for d in releases/*; do [ -d \"\$d\" ] && [ \"\$(basename \"\$d\")\" != \"\$CUR\" ] && rm -rf \"\$d\"; done; true; \
   mkdir -p 'releases/$RELEASE'; \
   tar -xzf - -C 'releases/$RELEASE' || { rm -rf 'releases/$RELEASE'; echo 'Unpack failed: disk or inode quota? (ADR-012)' >&2; exit 1; }; \
   APP_ROOT=\$HOME/$APP_DIR bash 'releases/$RELEASE/deploy/activate.sh' '$RELEASE'" <"$TMP/release.tgz"
