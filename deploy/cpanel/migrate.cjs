/**
 * Applies pending Prisma migrations on the cPanel server (docs/DEPLOYMENT.md, ADR-012).
 *
 *   node deploy/migrate.cjs [migrations-dir]     # DATABASE_URL from the environment
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
 */
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS run by the server's Node */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

// Prisma's own lock key, so this never runs concurrently with `prisma migrate`.
const LOCK_KEY = 72707369;
const ADD_VALUE = /^[ \t]*ALTER[ \t]+TYPE[ \t]+[^;]*?[ \t]ADD[ \t]+VALUE[ \t]+[^;]*;[ \t]*$/gim;

const log = (msg) => console.log(`[migrate] ${msg}`);

function adapt(sql, version) {
  let body = sql;
  const early = [];
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
  const text = String(err && err.message);
  if (/pg_trgm|gin_trgm_ops|word_similarity/i.test(text) || (err && err.code === "42501")) {
    return (
      "\n  The database user may not create the pg_trgm extension on this server. Ask the host to run" +
      '\n  `CREATE EXTENSION pg_trgm;` in this database (see docs/DEPLOYMENT.md, "pg_trgm"), then deploy again.'
    );
  }
  return "";
}

async function main() {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, "..", "prisma", "migrations"));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();

  const db = new Client({ connectionString: url });
  await db.connect();
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
    for (const name of names) {
      const sql = fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      if (applied.has(name)) {
        if (applied.get(name) !== checksum)
          log(`WARNING: ${name} was modified after it was applied`);
        continue;
      }
      const { early, body } = adapt(sql, version);
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
