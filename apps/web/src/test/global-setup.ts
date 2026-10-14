import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Applies migrations to the test database once per run. */
export default function setup() {
  const env = { ...process.env, ...config({ path: ".env.test", processEnv: {} }).parsed };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
}
