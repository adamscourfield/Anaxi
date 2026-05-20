import { describe, expect, it, vi } from "vitest";
import { adminBackgroundPrefetchSections, staggeredAdminPrefetch } from "@/lib/admin-prefetch";

describe("adminBackgroundPrefetchSections", () => {
  it("skips overview and dedupes nav sections", () => {
    expect(adminBackgroundPrefetchSections(["overview", "users", "users", "settings"])).toEqual([
      "users",
      "settings",
      "users-import",
    ]);
  });

  it("adds users-import when users is available", () => {
    expect(adminBackgroundPrefetchSections(["overview", "users"])).toEqual(["users", "users-import"]);
  });
});

describe("staggeredAdminPrefetch", () => {
  it("prefetches each section sequentially", () => {
    vi.useFakeTimers();
    const prefetched: string[] = [];
    const cancel = staggeredAdminPrefetch(
      ["users", "settings"],
      (s) => prefetched.push(s),
      { gapMs: 50 },
    );

    expect(prefetched).toEqual([]);
    vi.runAllTimers();
    expect(prefetched).toEqual(["users", "settings"]);

    cancel();
    vi.useRealTimers();
  });

  it("stops when cancelled", () => {
    vi.useFakeTimers();
    const prefetched: string[] = [];
    const cancel = staggeredAdminPrefetch(["users", "settings", "imports"], (s) => prefetched.push(s), {
      gapMs: 50,
    });

    vi.advanceTimersByTime(50);
    expect(prefetched.length).toBeGreaterThanOrEqual(1);
    cancel();
    vi.runAllTimers();
    expect(prefetched.length).toBe(1);

    vi.useRealTimers();
  });
});
