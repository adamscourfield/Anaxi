import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const key = `test-${Date.now()}-a`;
    expect((await checkRateLimit(key, { max: 3, windowMs: 60_000 })).allowed).toBe(true);
    expect((await checkRateLimit(key, { max: 3, windowMs: 60_000 })).allowed).toBe(true);
    expect((await checkRateLimit(key, { max: 3, windowMs: 60_000 })).allowed).toBe(true);
  });

  it("blocks when limit exceeded", async () => {
    const key = `test-${Date.now()}-b`;
    for (let i = 0; i < 2; i++) {
      expect((await checkRateLimit(key, { max: 2, windowMs: 60_000 })).allowed).toBe(true);
    }
    const blocked = await checkRateLimit(key, { max: 2, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
