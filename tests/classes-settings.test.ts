import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({settings:vi.fn(),vocab:vi.fn(),integration:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/prisma",()=>({prisma:{tenantSettings:{findUnique:mocks.settings},tenantVocab:{findMany:mocks.vocab},sharedIntegration:{findFirst:mocks.integration}}}));
import { classSettings } from "@/modules/classes/settings";
beforeEach(()=>{mocks.settings.mockResolvedValue({positivePointsLabel:"DTAs",detentionLabel:"Rerouting",internalExclusionLabel:"Navigation"});mocks.vocab.mockResolvedValue([{key:"detentions",labelPlural:"Reroutings"}]);mocks.integration.mockResolvedValue({config:{}});});
it("uses school labels and plural vocabulary instead of hard-coded behaviour nouns",async()=>{const result=await classSettings("school");expect(result.labels).toMatchObject({positive:"DTAs",detention:"Reroutings",internalExclusion:"Navigations"});expect(mocks.settings).toHaveBeenCalledWith({where:{tenantId:"school"}});expect(result.behaviourThrough).toBeNull();});
it("exposes the behaviour completion date separately from attendance",async()=>{mocks.integration.mockResolvedValue({config:{behaviourLastSyncedDate:"2026-10-09"}});expect((await classSettings("school")).behaviourThrough).toBe("2026-10-09");});
it("retains manual snapshot support for schools without Arbor",async()=>{mocks.integration.mockResolvedValue(null);expect((await classSettings("school")).behaviourThrough).toBeUndefined();});
