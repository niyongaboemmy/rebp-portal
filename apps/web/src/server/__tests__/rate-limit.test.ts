import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter } from "../rate-limit";

describe("memory rate limiter (SEC-006)", () => {
  it("allows up to the limit then blocks until the window resets", () => {
    let now = 0;
    const limiter = createMemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect(limiter.consume("k", 3, 1000).ok).toBe(true);
    const blocked = limiter.consume("k", 3, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    now = 1000;
    expect(limiter.consume("k", 3, 1000).ok).toBe(true);
  });

  it("tracks keys independently and can reset", () => {
    const limiter = createMemoryRateLimiter(() => 0);
    expect(limiter.consume("a", 1, 1000).ok).toBe(true);
    expect(limiter.consume("a", 1, 1000).ok).toBe(false);
    expect(limiter.consume("b", 1, 1000).ok).toBe(true);
    limiter.reset("a");
    expect(limiter.consume("a", 1, 1000).ok).toBe(true);
  });
});
