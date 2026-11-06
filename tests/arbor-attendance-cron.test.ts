import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorized: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/cronAuth", () => ({ assertCronAuthorized: mocks.authorized }));
vi.mock("@/lib/integrations/arbor/runScheduledSync", () => ({ runScheduledArborSync: mocks.sync }));
import { GET } from "@/app/api/cron/arbor-attendance/route";
afterEach(() => vi.useRealTimers());
describe("attendance scheduler", () => {
  it("processes an authenticated delayed call outside 2am", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T16:00:00Z"));
    mocks.authorized.mockReturnValue(null);
    mocks.sync.mockResolvedValue({ results: [], failed: 0 });
    expect((await GET(new Request("https://example.test/api/cron/arbor-attendance"))).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
  it("still rejects unauthenticated calls", async () => {
    mocks.sync.mockClear();
    mocks.authorized.mockReturnValue(new Response(null, { status: 403 }));
    expect((await GET(new Request("https://example.test/api/cron/arbor-attendance"))).status).toBe(403);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("reports a failed school import as an HTTP failure for the scheduler", async () => {
    mocks.authorized.mockReturnValue(null);
    const results = [{ ok: false, status: 429, body: { error: "Arbor rate limited the import" } }];
    mocks.sync.mockResolvedValue({ results, failed: 1 });
    const response = await GET(new Request("https://example.test/api/cron/arbor-attendance"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ connections: results });
  });
});
