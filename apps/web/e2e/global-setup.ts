import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Migrate and seed the E2E database (the seed is idempotent). */
export default function globalSetup() {
  const env = { ...process.env, ...config({ path: ".env.test", processEnv: {} }).parsed };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db seed", { env, stdio: "pipe" });
}
