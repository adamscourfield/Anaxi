export type LegacyQuery = Record<string, string | string[] | undefined>;

export function migrateInsightsUrl(path: string, input: LegacyQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach(v => params.append(key,v));
    else if (value !== undefined) params.set(key,value);
  }
  let destination = "/insights";
  const detailed: Record<string,string> = {
    "/explorer/teachers":"/insights/teaching/evidence",
    "/explorer/departments":"/insights/teaching/departments",
    "/explorer/signals":"/insights/teaching/signals",
    "/explorer/observations":"/insights/teaching/observations",
    "/explorer/cohorts":"/insights/students/groups",
    "/explorer/analysis":"/insights/students/patterns",
    "/explorer/assessment/students":"/insights/attainment/student-evidence",
    "/explorer/assessment/cohorts":"/insights/attainment/group-evidence",
    "/explorer/assessment/teachers":"/insights/attainment/teacher-evidence",
  };
  if (detailed[path]) destination = detailed[path];
  else if (path === "/explorer/assessment") destination = "/insights/attainment";
  else if (path === "/explorer/students") {
    // Retain archival, saved-view and bulk workflows in the directory.
    if (params.has("status") && params.get("status") !== "active" || params.get("windowDays")==="90") destination="/students";
    else {
      destination="/insights/students";
      if(params.has("studentSearch")) { params.set("q",params.get("studentSearch")!); params.delete("studentSearch"); }
      if(params.get("watchlist")==="1") params.set("view","watchlist");
      else if(params.get("view")==="watch") { params.set("view","all"); params.set("band","WATCH"); }
      else if(params.get("view")==="stable") { params.set("view","all"); params.set("band","STABLE"); }
      else if(!params.has("view")) params.set("view",params.has("band")?"attention":"all");
      params.delete("watchlist");
    }
  } else if(path === "/analytics") {
    // Advanced sorting/export views keep their exact original query contract.
    if(params.has("sort") || params.has("dir") || params.get("window")==="90") destination="/insights/priorities";
    else {
      const tab=params.get("tab")??"teachers";
      destination=tab==="students"?"/insights/students":"/insights/teaching";
      if(params.has("window")) {params.set("windowDays",params.get("window")!);params.delete("window");}
      if(tab==="students") {
        params.set("view",params.get("watchlist")==="1"?"watchlist":params.has("band")?"attention":"all");
        params.delete("watchlist");
      } else params.set("view",tab==="cpd"?"cpd":"teachers");
      params.delete("tab");
    }
  }
  const query=params.toString();
  return destination+(query?"?"+query:"");
}

export function safeInsightsReturn(value: unknown): string | undefined {
  if(typeof value !== "string" || !/^\/insights(?:[/?]|$)/.test(value) || value.includes("\\") || /[\r\n]/.test(value)) return undefined;
  return value;
}
