/**
 * Fixed-window rate limiter (SEC-006). In-memory for the pilot's single instance;
 * swap for a Redis implementation behind the same interface when scaling out.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): RateLimitResult;
  reset(key: string): void;
}

export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = now();

  function sweep(current: number) {
    if (current - lastSweep < 60_000) return;
    lastSweep = current;
    for (const [key, bucket] of buckets) if (bucket.resetAt <= current) buckets.delete(key);
  }

  return {
    consume(key, limit, windowMs) {
      const current = now();
      sweep(current);
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= current) {
        bucket = { count: 0, resetAt: current + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count++;
      const ok = bucket.count <= limit;
      return {
        ok,
        remaining: Math.max(0, limit - bucket.count),
        retryAfterSeconds: ok ? 0 : Math.ceil((bucket.resetAt - current) / 1000),
      };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

const globalForLimiter = globalThis as unknown as { rateLimiter?: RateLimiter };
export const rateLimiter = (globalForLimiter.rateLimiter ??= createMemoryRateLimiter());

/** Named policies so limits live in one place. */
export const RATE_LIMITS = {
  signIn: { limit: 10, windowMs: 15 * 60_000 },
  /** Google ID-token sign-in and its nonce requests. */
  googleSignIn: { limit: 20, windowMs: 15 * 60_000 },
  signUp: { limit: 5, windowMs: 60 * 60_000 },
  otpSend: { limit: 5, windowMs: 15 * 60_000 },
  otpVerify: { limit: 10, windowMs: 15 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  upload: { limit: 60, windowMs: 10 * 60_000 },
  lookup: { limit: 120, windowMs: 10 * 60_000 },
  /** FR-REG-005: anti-scraping budget for anonymous register searches. */
  registerSearch: { limit: 120, windowMs: 10 * 60_000 },
  signature: { limit: 10, windowMs: 15 * 60_000 },
  payment: { limit: 20, windowMs: 15 * 60_000 },
} as const;
