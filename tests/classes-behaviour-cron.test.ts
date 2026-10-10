import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),sync:vi.fn()}));
vi.mock("@/lib/cronAuth",()=>({assertCronAuthorized:mocks.auth}));
vi.mock("@/lib/integrations/arbor/runScheduledSync",()=>({runScheduledArborSync:mocks.sync}));
import { GET } from "@/app/api/cron/arbor-behaviour/route";
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockReturnValue(null);mocks.sync.mockResolvedValue({results:[],failed:0});vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-10T14:00:00Z"));});
afterEach(()=>vi.useRealTimers());
it("runs a protected behaviour catch-up when GitHub scheduling arrives after 2am",async()=>{const response=await GET(new Request("https://www.anaxi.io/api/cron/arbor-behaviour"));expect(response.status).toBe(200);expect(mocks.sync).toHaveBeenCalledOnce();expect(await response.json()).not.toHaveProperty("skipped");});
it("retains scheduler authentication",async()=>{mocks.auth.mockReturnValue(new Response(null,{status:401}));expect((await GET(new Request("https://www.anaxi.io/api/cron/arbor-behaviour"))).status).toBe(401);expect(mocks.sync).not.toHaveBeenCalled();});
