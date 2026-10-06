import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { runScheduledArborSync } from "@/lib/integrations/arbor/runScheduledSync";

function londonHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((part) => part.type === "hour")?.value);
}

function isAssessmentDiscoveryWindow(hour: number) {
  // Keep the more frequent read-only discovery work out of the school day.
  return hour >= 18 || hour < 7;
}

export async function GET(req: Request) {
  const denied = assertCronAuthorized(req); if (denied) return denied;
  const hour = londonHour();
  const discoveryOnly = new URL(req.url).searchParams.get("discoveryOnly") === "1";
  if (discoveryOnly && !isAssessmentDiscoveryWindow(hour)) {
    return NextResponse.json({ skipped: "outside the 18:00-07:00 Europe/London assessment discovery window" });
  }
  if (!discoveryOnly && hour !== 2) return NextResponse.json({ skipped: "outside 2am Europe/London" });

  const sync = discoveryOnly
    ? { results: [], failed: 0 }
    : await runScheduledArborSync(req, "/api/god/integrations/arbor/sync/assessments");
  // Historic review is deliberately read-only. Continue several bounded
  // target-roster passes each night so God Mode users never need to click
  // through a long catalogue by hand.
  const discovery = [];
  const passes = discoveryOnly ? 1 : 4;
  for (let pass = 0; pass < passes; pass++) {
    const result = await runScheduledArborSync(req, "/api/god/integrations/arbor/preview/assessments/history");
    discovery.push(result.results);
    if (result.failed || result.results.every((item) => Boolean((item.body as { complete?: boolean } | null)?.complete))) break;
  }
  const failed = sync.failed + discovery.reduce((total, result) => total + result.filter((item) => !item.ok).length, 0);
  return NextResponse.json({ connections: sync.results, historicDiscovery: discovery }, { status: failed ? 207 : 200 });
}
