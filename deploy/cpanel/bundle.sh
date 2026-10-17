#!/usr/bin/env bash
# Packs the standalone build into a release folder for cPanel (docs/DEPLOYMENT.md, ADR-012).
# Run from the repository root after `NEXT_OUTPUT=standalone pnpm --filter @rebp/web build`:
#
#   bash deploy/cpanel/bundle.sh release      # -> ./release, ready to tar and upload
#
# Layout (traced from the monorepo root):
#   apps/web/server.js, apps/web/.next/static, apps/web/public   the Next.js server and assets
#   node_modules/                                                 traced dependencies (flat layout)
#   prisma/migrations/                                            applied by deploy/migrate.cjs
#   deploy/                                                       app.cjs, activate.sh, cron.sh, …
set -euo pipefail

OUT="${1:?usage: bundle.sh <out-dir>}"
WEB=apps/web
DIST="$WEB/${NEXT_DIST_DIR:-.next}"
[ -f "$DIST/standalone/$WEB/server.js" ] || {
  echo "No standalone build in $DIST (build with NEXT_OUTPUT=standalone)"
  exit 1
}

rm -rf "$OUT"
cp -a "$DIST/standalone" "$OUT"
cp -a "$WEB/public" "$OUT/$WEB/public"
mkdir -p "$OUT/$WEB/.next"
cp -a "$DIST/static" "$OUT/$WEB/.next/static"
mkdir -p "$OUT/prisma" "$OUT/deploy"
cp -a "$WEB/prisma/migrations" "$OUT/prisma/migrations"
cp deploy/cpanel/app.cjs deploy/cpanel/activate.sh deploy/cpanel/cron.sh \
  deploy/cpanel/migrate.cjs deploy/cpanel/create-admin.cjs "$OUT/deploy/"

# The cPanel Node preserves symlinked paths. With pnpm's symlinked (isolated) layout, packages
# then resolve from the wrong place and every database page fails (pg-types → postgres-array).
# Release builds install with `nodeLinker: hoisted` (deploy.yml), so the trace has real folders.
if [ -d "$OUT/node_modules/.pnpm" ]; then
  echo "The build used pnpm's symlinked layout; install with nodeLinker: hoisted (see deploy.yml)"
  exit 1
fi

# The deploy scripts get complete copies of their dependencies in deploy/node_modules: Next's trace
# keeps only the files the app itself loads (pg-types without postgres-array, for instance).
node - "$WEB" "$OUT/deploy/node_modules" pg @node-rs/argon2 <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const [web, out, ...roots] = process.argv.slice(2);
const seen = new Set();
// Node's lookup order, without `exports` maps (not every package exports its package.json).
const find = (name, from) => {
  const dirs = createRequire(path.resolve(from, "package.json")).resolve.paths(name) || [];
  for (const dir of dirs) {
    const manifest = path.join(dir, name, "package.json");
    if (fs.existsSync(manifest)) return manifest;
  }
  return null;
};
// pg is a dependency of @prisma/adapter-pg, not of the app: pnpm resolves it from there.
const adapter = path.dirname(fs.realpathSync(find("@prisma/adapter-pg", web)));
function vendor(name, from) {
  const manifest = find(name, from) || (from === web ? find(name, adapter) : null);
  if (!manifest) return; // optional dependency for another platform
  if (seen.has(name)) return;
  seen.add(name);
  const dir = fs.realpathSync(path.dirname(manifest));
  fs.cpSync(dir, path.join(out, name), { recursive: true, dereference: true });
  const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) vendor(dep, dir);
}
for (const name of roots) vendor(name, web);
console.log(`Vendored for deploy scripts: ${[...seen].join(", ")}`);
NODE
# The app loads argon2's native binary at runtime by platform name, so the trace only holds the
# build machine's. Give it every installed platform build (the server's, when built elsewhere).
for pkg in "$OUT"/deploy/node_modules/@node-rs/argon2-*; do
  [ -e "$OUT/node_modules/@node-rs/$(basename "$pkg")" ] || cp -a "$pkg" "$OUT/node_modules/@node-rs/"
done
git rev-parse HEAD >"$OUT/REVISION" 2>/dev/null || true

# Inode budget: the cPanel account is shared and capped at 300,000 files (inodes), with only a
# few thousand free. Drop what Node never loads at runtime (source maps, type declarations,
# readmes, changelogs; licences stay), then hard-link identical files (deploy/node_modules copies
# much of node_modules) so each set costs one inode. tar keeps hard links when it unpacks.
find "$OUT" -type f \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \
  -o -iname 'readme*' -o -iname 'changelog*' -o -iname 'history.md' \) -delete
find "$OUT" -type d -empty -delete
node - "$OUT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = process.argv[2];
const byHash = new Map();
let linked = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile()) {
      const data = fs.readFileSync(file);
      const key = `${fs.statSync(file).mode}:${crypto.createHash("sha256").update(data).digest("hex")}`;
      const first = byHash.get(key);
      if (!first) byHash.set(key, file);
      else {
        fs.rmSync(file);
        fs.linkSync(first, file);
        linked += 1;
      }
    }
  }
})(root);
console.log(`Hard-linked ${linked} duplicate files`);
NODE

# Never ship local data or secrets.
for bad in .env .env.local .env.production .env.test "$WEB/.env" "$WEB/.env.local" "$WEB/.env.test" "$WEB/var"; do
  if [ -e "$OUT/$bad" ]; then echo "Refusing to bundle $bad"; exit 1; fi
done
# What the server pays for: one inode per directory and per distinct file.
INODES=$(( $(find "$OUT" -type d | wc -l) + $(find "$OUT" -type f -exec ls -i {} + | awk '{print $1}' | sort -u | wc -l) ))
echo "Bundled $(find "$OUT" -type f | wc -l | tr -d ' ') files, $INODES inodes ($(du -sh "$OUT" | cut -f1)) into $OUT"
