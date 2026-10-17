/**
 * Applies pending Prisma migrations on the cPanel server (docs/DEPLOYMENT.md, ADR-012).
 *
 *   node deploy/migrate.cjs [migrations-dir]             # apply; DATABASE_URL from the environment
 *   node deploy/migrate.cjs --pending [migrations-dir]   # read-only: print how many are pending
 *
 * The release ships no Prisma CLI (its schema engine is a native binary for another platform and
 * thousands of files against the account's inode cap), so this applies `prisma/migrations/*` itself
 * and records them in `_prisma_migrations` exactly as `prisma migrate deploy` does (same table,
 * same SHA-256 checksum, same advisory lock). The Prisma CLI keeps working against the database.
 *
 * The host runs PostgreSQL 10, older than the migrations were written for. Two syntax-only
 * adjustments are made in memory, by server version (the files and their checksums are unchanged):
 *   - < 11: `EXECUTE FUNCTION` in trigger definitions becomes its alias `EXECUTE PROCEDURE`.
 *   - < 12: `ALTER TYPE … ADD VALUE` cannot run in a transaction, so each one runs first, on its
 *     own, as `ADD VALUE IF NOT EXISTS` (idempotent if the rest of the migration then fails).
 * Each migration otherwise runs in one transaction: a failure leaves the schema as it was.
 *
 * pg_trgm (register search, FR-REG-002): on PostgreSQL 10 only a superuser may create it. When this
 * database user can't, `CREATE EXTENSION pg_trgm` is replaced by a plain-SQL `word_similarity(text,
 * text)` (the only trigram function the app calls, ADR-006) and the trigram GIN index is skipped.
 * Search then scans the register (fine at pilot size). To switch to the real extension later, see
 * docs/DEPLOYMENT.md, "pg_trgm".
 */
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS run by the server's Node */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

// Prisma's own lock key, so this never runs concurrently with `prisma migrate`.
const LOCK_KEY = 72707369;
const ADD_VALUE = /^[ \t]*ALTER[ \t]+TYPE[ \t]+[^;]*?[ \t]ADD[ \t]+VALUE[ \t]+[^;]*;[ \t]*$/gim;

const CREATE_TRGM =
  /^[ \t]*CREATE[ \t]+EXTENSION[ \t]+(?:IF[ \t]+NOT[ \t]+EXISTS[ \t]+)?"?pg_trgm"?[^;]*;/gim;
const TRGM_INDEX = /^[ \t]*CREATE[ \t]+INDEX[^;]*gin_trgm_ops[^;]*;/gim;

// Stand-in for pg_trgm's word_similarity(q, t): the best Jaccard similarity between the trigrams of
// q and those of any run of consecutive words in t (pg_trgm uses runs of trigrams; close enough for
// the 0.35 threshold). Trigrams follow pg_trgm: lower-cased alphanumeric words padded "  w ".
const TRGM_SHIM = `
CREATE OR REPLACE FUNCTION rebp_trgm_words(s text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(array_agg(w ORDER BY n), '{}')
  FROM regexp_split_to_table(lower(coalesce(s, '')), '[^[:alnum:]]+') WITH ORDINALITY AS t(w, n)
  WHERE w <> ''
$f$;
CREATE OR REPLACE FUNCTION rebp_trgm(words text[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(array_agg(DISTINCT substr('  ' || w || ' ', i, 3)), '{}')
  FROM unnest(words) AS w, generate_series(1, length(w) + 1) AS i
$f$;
CREATE OR REPLACE FUNCTION word_similarity(q text, t text) RETURNS real
LANGUAGE plpgsql IMMUTABLE STRICT AS $f$
DECLARE
  qw text[] := rebp_trgm_words(q);
  tw text[] := rebp_trgm_words(t);
  qg text[] := rebp_trgm(qw);
  n int := coalesce(array_length(qw, 1), 0);
  m int := coalesce(array_length(tw, 1), 0);
  best real := 0;
  wg text[];
  common int;
  total int;
BEGIN
  IF n = 0 OR m = 0 THEN RETURN 0; END IF;
  FOR k IN 1 .. least(m, n + 1) LOOP
    CONTINUE WHEN k < n - 1 AND k < m;
    FOR i IN 1 .. m - k + 1 LOOP
      wg := rebp_trgm(tw[i:i + k - 1]);
      SELECT count(*) INTO common FROM (SELECT unnest(qg) INTERSECT SELECT unnest(wg)) x;
      total := cardinality(qg) + cardinality(wg) - common;
      IF total > 0 AND common::real / total > best THEN best := common::real / total; END IF;
    END LOOP;
  END LOOP;
  RETURN best;
END
$f$;`;

const log = (msg) => console.log(`[migrate] ${msg}`);

/** True when pg_trgm is installed or this user may create it (tried, then rolled back). */
async function trgmAvailable(db) {
  const installed = await db.query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`);
  if (installed.rowCount) return true;
  try {
    await db.query("BEGIN");
    await db.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    return true;
  } catch {
    return false;
  } finally {
    await db.query("ROLLBACK").catch(() => {});
  }
}

function adapt(sql, version, trgm) {
  let body = sql;
  const early = [];
  if (!trgm && CREATE_TRGM.test(body)) {
    CREATE_TRGM.lastIndex = 0;
    log("pg_trgm is not available to this user: installing the plain-SQL word_similarity instead");
    body = body
      .replace(
        CREATE_TRGM,
        () => `-- pg_trgm unavailable (ADR-012): plain-SQL stand-in${TRGM_SHIM}`,
      )
      .replace(
        TRGM_INDEX,
        (stmt) => `-- skipped without pg_trgm: ${stmt.trim().replace(/\n/g, " ")}`,
      );
  }
  CREATE_TRGM.lastIndex = 0;
  if (version < 110000) body = body.replace(/\bEXECUTE\s+FUNCTION\b/gi, "EXECUTE PROCEDURE");
  if (version < 120000) {
    body = body.replace(ADD_VALUE, (stmt) => {
      early.push(
        stmt.trim().replace(/ADD\s+VALUE\s+(?!IF\s+NOT\s+EXISTS)/i, "ADD VALUE IF NOT EXISTS "),
      );
      return `-- (applied before the transaction) ${stmt.trim()}`;
    });
  }
  return { early, body };
}

function hint(err) {
  if (/gin_trgm_ops|similarity|%>|<%/i.test(String(err && err.message))) {
    return (
      "\n  This migration uses pg_trgm features beyond word_similarity(text, text), which the stand-in" +
      '\n  does not provide. Have the host create the extension (docs/DEPLOYMENT.md, "pg_trgm").'
    );
  }
  return "";
}

/** Read-only count of migrations not yet recorded as applied (activate.sh skips work when 0). */
async function countPending(db, names) {
  const table = await db.query(`SELECT to_regclass('"_prisma_migrations"') AS t`);
  if (!table.rows[0].t) return names.length;
  const done = await db.query(
    `SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL AND finished_at IS NOT NULL`,
  );
  const applied = new Set(done.rows.map((r) => r.migration_name));
  return names.filter((n) => !applied.has(n)).length;
}

async function main() {
  const args = process.argv.slice(2);
  const pendingOnly = args.includes("--pending");
  const dirArg = args.find((a) => !a.startsWith("--"));
  const dir = path.resolve(dirArg || path.join(__dirname, "..", "prisma", "migrations"));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();

  const db = new Client({ connectionString: url });
  await db.connect();
  if (pendingOnly) {
    try {
      console.log(await countPending(db, names));
    } finally {
      await db.end();
    }
    return;
  }
  try {
    const version = Number((await db.query("SHOW server_version_num")).rows[0].server_version_num);
    await db.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await db.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum"            VARCHAR(64) NOT NULL,
      "finished_at"         TIMESTAMPTZ,
      "migration_name"      VARCHAR(255) NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      TIMESTAMPTZ,
      "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`);
    const rows = (
      await db.query(
        `SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`,
      )
    ).rows;
    const failed = rows.filter((r) => !r.finished_at);
    if (failed.length) {
      throw new Error(
        `Unfinished migration(s) recorded: ${failed.map((r) => r.migration_name).join(", ")}. ` +
          "Fix the schema by hand, then `prisma migrate resolve` (docs/DEPLOYMENT.md).",
      );
    }
    const applied = new Map(rows.map((r) => [r.migration_name, r.checksum]));
    const known = new Set(names);
    for (const name of applied.keys()) {
      if (!known.has(name)) log(`WARNING: ${name} is in the database but not in this release`);
    }

    const pending = names.filter((n) => !applied.has(n));
    log(`PostgreSQL ${version}; ${applied.size} applied, ${pending.length} pending`);
    const trgm = pending.length ? await trgmAvailable(db) : true;
    for (const name of names) {
      const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      if (applied.has(name)) {
        if (applied.get(name) !== checksum)
          log(`WARNING: ${name} was modified after it was applied`);
        continue;
      }
      const { early, body } = adapt(sql, version, trgm);
      const id = crypto.randomUUID();
      log(`Applying ${name}`);
      try {
        for (const stmt of early) await db.query(stmt);
        await db.query("BEGIN");
        await db.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at) VALUES ($1, $2, $3, now())`,
          [id, checksum, name],
        );
        await db.query(body);
        await db.query(
          `UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`,
          [id],
        );
        await db.query("COMMIT");
      } catch (err) {
        await db.query("ROLLBACK").catch(() => {});
        err.message = `${name}: ${err.message}${hint(err)}`;
        throw err;
      }
    }
    log("Database schema is up to date");
  } finally {
    await db.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    await db.end();
  }
}

main().catch((err) => {
  console.error(`[migrate] FAILED: ${err.message}`);
  process.exit(1);
});
