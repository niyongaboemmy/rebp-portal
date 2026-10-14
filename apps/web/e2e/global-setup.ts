import { execSync } from "node:child_process";
import { config } from "dotenv";
import { db } from "./db";

/** Migrate and seed the E2E database (the seed is idempotent), and clear matrix overrides. */
export default async function globalSetup() {
  const env = { ...process.env, ...config({ path: ".env.test", processEnv: {} }).parsed };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db seed", { env, stdio: "pipe" });
  await db.rolePermission.deleteMany({});
  await db.$disconnect();
}
