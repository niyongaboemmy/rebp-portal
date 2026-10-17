/**
 * First-deploy bootstrap: creates the first system administrator (docs/DEPLOYMENT.md, ADR-012).
 *
 *   node deploy/create-admin.cjs <credentials-file>
 *
 * Production is never seeded with the demo accounts (their password is public). Instead, while no
 * active SYSTEM_ADMIN exists and BOOTSTRAP_ADMIN_EMAIL is set, this creates that account with a
 * random password and writes it to <credentials-file> (mode 600) on the server, never to the log.
 * The administrator enrols two-step verification at first sign-in (FR-ACC-004) and changes the
 * password. Once an administrator exists it does nothing, so it is safe on every deploy.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS run by the server's Node */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { Client } = require("pg");
const { hash } = require("@node-rs/argon2");

// Same parameters as src/server/auth/password.ts.
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const log = (msg) => console.log(`[admin] ${msg}`);

async function main() {
  const file = process.argv[2];
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!file) throw new Error("usage: create-admin.cjs <credentials-file>");
  if (!email) return log("BOOTSTRAP_ADMIN_EMAIL not set; skipped");

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const admins = await db.query(
      `SELECT 1 FROM "User" WHERE 'SYSTEM_ADMIN' = ANY(roles) AND "disabledAt" IS NULL LIMIT 1`,
    );
    if (admins.rowCount) return log("An administrator exists; nothing to do");
    const taken = await db.query(`SELECT 1 FROM "User" WHERE email = $1`, [email]);
    if (taken.rowCount) {
      return log(`WARNING: ${email} already has an account; grant it the role from the database`);
    }

    // 24 characters from four classes, so it passes any password policy.
    const password = `${crypto.randomBytes(18).toString("base64url")}aZ7!`;
    const name = (process.env.BOOTSTRAP_ADMIN_NAME || "").trim() || "System administrator";
    await db.query(
      `INSERT INTO "User" (id, email, "fullName", roles, "emailVerifiedAt", "phoneVerifiedAt",
         "passwordHash", "passwordChangedAt", "updatedAt")
       VALUES ($1, $2, $3, ARRAY['SYSTEM_ADMIN']::"Role"[], now(), now(), $4, now(), now())`,
      [crypto.randomUUID(), email, name, await hash(password, ARGON2_OPTIONS)],
    );
    const site = (process.env.APP_URL || "").replace(/\/$/, "");
    fs.writeFileSync(
      file,
      [
        `REBP Portal administrator (created ${new Date().toISOString()})`,
        `URL: ${site}/sign-in`,
        `Email: ${email}`,
        `Password: ${password}`,
        "",
        "Sign in, enrol two-step verification, change the password, then delete this file.",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    log(`Created administrator ${email}; credentials written to ${file}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(`[admin] FAILED: ${err.message}`);
  process.exit(1);
});
