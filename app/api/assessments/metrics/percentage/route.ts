/**
 * GET /api/assessments/metrics/percentage
 *
 * Percentage & Raw score attainment analysis for a single result point.
 *
 * Query params:
 *   pointId   — required
 *   yearGroup — optional filter
 *
 * Returns:
 *   - Year group mean % and score distribution (10% bands)
 *   - Per-subject: mean, median, IQR, PP/SEND gap, teaching group breakdown,
 *     top 10 / bottom 10 students
 *   - Overall student leaderboard (top 10 / bottom 10 by mean across subjects)
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { computePercentageSummary } from "@/modules/assessments/percentageAnalysis";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");
  const yearGroup = searchParams.get("yearGroup") || undefined;

  if (!pointId) {
    return NextResponse.json({ error: "pointId is required" }, { status: 400 });
  }

  const summary = await computePercentageSummary(user.tenantId, pointId, yearGroup);

  if (!summary) {
    return NextResponse.json(
      { error: "No percentage/raw assessments found for this point" },
      { status: 404 }
    );
  }

  return NextResponse.json(summary);
});
