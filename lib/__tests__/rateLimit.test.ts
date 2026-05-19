import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Date.now()}-a`;
    expect(checkRateLimit(key, { max: 3, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(key, { max: 3, windowMs: 60_000 }).allowed).toBe(true);
    expect(checkRateLimit(key, { max: 3, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("blocks when limit exceeded", () => {
    const key = `test-${Date.now()}-b`;
    for (let i = 0; i < 2; i++) {
      expect(checkRateLimit(key, { max: 2, windowMs: 60_000 }).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, { max: 2, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
