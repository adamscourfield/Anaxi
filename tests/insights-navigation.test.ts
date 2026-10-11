import { describe, expect, it } from "vitest";
import { migrateInsightsUrl, safeInsightsReturn } from "@/lib/insights-navigation";
const url = (path:string, query:Record<string,string|string[]>) => new URL(migrateInsightsUrl(path,query),"https://anaxi.test");
describe("Insights migration",()=>{
  it("preserves historical teacher pivots and their scope",()=>{
    const result=url("/explorer/teachers",{departmentId:"d1",windowDays:"90",sort:"coverage",page:"3"});
    expect(result.pathname).toBe("/insights/teaching/evidence");
    expect(Object.fromEntries(result.searchParams)).toEqual({departmentId:"d1",windowDays:"90",sort:"coverage",page:"3"});
  });
  it("translates a student search and personal watchlist without dropping filters",()=>{
    const result=url("/explorer/students",{studentSearch:"A & B",watchlist:"1",send:"true",page:"2"});
    expect(result.pathname).toBe("/insights/students");
    expect(result.searchParams.get("q")).toBe("A & B");
    expect(result.searchParams.get("view")).toBe("watchlist");
    expect(result.searchParams.get("send")).toBe("true");
    expect(result.searchParams.get("page")).toBe("2");
  });
  it("keeps archival workflows in the directory",()=>{
    expect(url("/explorer/students",{status:"archived"}).pathname).toBe("/students");
  });
  it("keeps the original all-students default for old bookmarks",()=>{
    expect(url("/explorer/students",{}).searchParams.get("view")).toBe("all");
  });
  it("translates old watch-band views without confusing them with personal watchlists",()=>{
    const result=url("/explorer/students",{view:"watch"});
    expect(result.searchParams.get("band")).toBe("WATCH");
    expect(result.searchParams.get("view")).toBe("all");
  });
  it("translates priorities periods and departments",()=>{
    const result=url("/analytics",{tab:"cpd",window:"28",department:"d1"});
    expect(result.pathname).toBe("/insights/teaching");
    expect(result.searchParams.get("view")).toBe("cpd");
    expect(result.searchParams.get("windowDays")).toBe("28");
    expect(result.searchParams.get("department")).toBe("d1");
  });
  it("preserves advanced sorting without changing its semantics",()=>{
    const result=url("/analytics",{tab:"students",sort:"score",dir:"asc"});
    expect(result.pathname).toBe("/insights/priorities");
    expect(result.searchParams.get("sort")).toBe("score");
  });
  it("preserves assessment datasets and repeated filters",()=>{
    const result=url("/explorer/assessment/cohorts",{cycle:"c1",yearGroup:["Y8","Y9"]});
    expect(result.pathname).toBe("/insights/attainment/group-evidence");
    expect(result.searchParams.getAll("yearGroup")).toEqual(["Y8","Y9"]);
    expect(result.searchParams.get("cycle")).toBe("c1");
  });
});
describe("Insights return paths",()=>{
  it.each(["//evil.test","/insights-evil","https://evil.test","/insights\\evil","/insights\nLocation: evil"] )("rejects unsafe or unrelated %s",value=>{
    expect(safeInsightsReturn(value)).toBeUndefined();
  });
  it("accepts local filtered investigation paths",()=>{
    expect(safeInsightsReturn("/insights/teaching?view=teachers&q=Alice")).toBe("/insights/teaching?view=teachers&q=Alice");
  });
});
