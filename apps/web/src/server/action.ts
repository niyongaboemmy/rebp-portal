import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { env } from "./env";
import { isAppError, AppError } from "./errors";
import { rateLimiter, RATE_LIMITS } from "./rate-limit";
import { getRequestContext } from "./request-context";

/** Wraps a server action body: maps domain and validation errors to an ActionResult. */
export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    unstable_rethrow(error);
    if (isAppError(error)) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors, meta: error.meta };
    }
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
      return { ok: false, error: "errors.validation", fieldErrors };
    }
    // Never log the payload: it may carry passwords or PII (DoD "no PII in logs").
    console.error("[action] unexpected error", (error as Error)?.name, (error as Error)?.message);
    return { ok: false, error: "errors.unexpected" };
  }
}

/** Throws `rateLimited` when the caller (by IP + optional key) exceeds the named policy. */
export async function enforceRateLimit(policy: keyof typeof RATE_LIMITS, key = "") {
  const { ipAddress } = await getRequestContext();
  const { limit, windowMs } = RATE_LIMITS[policy];
  const result = rateLimiter.consume(
    `${policy}:${ipAddress ?? "unknown"}:${key}`,
    limit * env().RATE_LIMIT_SCALE,
    windowMs,
  );
  if (!result.ok)
    throw new AppError("rateLimited", "errors.rateLimited", undefined, {
      retryAfterSeconds: result.retryAfterSeconds,
    });
}
