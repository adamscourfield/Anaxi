import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(()=>({ meetingAction:{findMany:vi.fn(),count:vi.fn()}, meeting:{findMany:vi.fn()} }));
vi.mock("@/lib/prisma",()=>({prisma:db}));
import { fetchLeaderWork } from "@/modules/home/leaderWork";
const user = {id:"leader-1",tenantId:"school-1",role:"SLT"} as Parameters<typeof fetchLeaderWork>[0];
beforeEach(()=>{vi.resetAllMocks();db.meetingAction.findMany.mockResolvedValue([]);db.meetingAction.count.mockResolvedValue(0);db.meeting.findMany.mockResolvedValue([]);});
describe("leader daily work",()=>{
  it("does not query disabled meeting features",async()=>{expect(await fetchLeaderWork(user,false)).toBeNull();expect(db.meeting.findMany).not.toHaveBeenCalled();expect(db.meetingAction.findMany).not.toHaveBeenCalled();});
  it("scopes tasks to the tenant and signed-in owner, including blocked work",async()=>{
    await fetchLeaderWork(user,true);
    expect(db.meetingAction.findMany.mock.calls[0][0].where).toEqual({tenantId:"school-1",ownerUserId:"leader-1",status:{in:["OPEN","BLOCKED"]}});
    expect(db.meetingAction.count.mock.calls[0][0].where).toEqual(db.meetingAction.findMany.mock.calls[0][0].where);
    expect(db.meeting.findMany.mock.calls[0][0].where).toMatchObject({tenantId:"school-1",status:{not:"CANCELLED"},OR:[{createdByUserId:"leader-1"},{attendees:{some:{userId:"leader-1"}}}]});
  });
  it("uses the London calendar day around midnight in summer time",async()=>{
    db.meeting.findMany.mockResolvedValue([
      {id:"previous",startDateTime:new Date("2026-07-10T22:30:00Z")},
      {id:"today",startDateTime:new Date("2026-07-10T23:30:00Z")},
      {id:"tomorrow",startDateTime:new Date("2026-07-11T23:30:00Z")},
    ]);
    const result=await fetchLeaderWork(user,true,new Date("2026-07-10T23:15:00Z"));
    expect(result?.meetings?.map(m=>m.id)).toEqual(["today"]);
  });
  it("keeps unavailable data distinct from an empty work queue",async()=>{
    db.meetingAction.findMany.mockRejectedValue(new Error("offline"));db.meetingAction.count.mockRejectedValue(new Error("offline"));
    const result=await fetchLeaderWork(user,true);
    expect(result?.actions).toBeNull();expect(result?.actionCount).toBeNull();expect(result?.meetings).toEqual([]);
  });
});
