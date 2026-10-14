import "server-only";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== "" ? value : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_ENCRYPTION_KEY: z.string().min(32, "APP_ENCRYPTION_KEY must be at least 32 characters"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_FROM: z.string().default("REBP Portal <no-reply@rebp.local>"),
  SMS_PROVIDER: z.enum(["mock"]).default("mock"),
  /**
   * Keep message bodies (which contain one-time codes) in NotificationLog. Defaults to on outside
   * production and off in production; enable only for automated test environments.
   */
  NOTIFICATION_STORE_BODIES: z.enum(["true", "false"]).optional(),
  /** Multiplies every rate-limit budget; raise only for automated test environments. */
  RATE_LIMIT_SCALE: z.coerce.number().positive().default(1),
  AUTH_BREACHED_PASSWORD_CHECK: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Fails fast with a readable message on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
export const storeNotificationBodies = () =>
  env().NOTIFICATION_STORE_BODIES ? env().NOTIFICATION_STORE_BODIES === "true" : !isProduction();
export const isGoogleEnabled = () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
