/**
 * GET /api/assessments/compare/ranks
 *
 * Rank movement analysis for PERCENTAGE / RAW format assessments between
 * two result points.
 *
 * Query params:
 *   fromPointId — required
 *   toPointId   — required
 *   yearGroup   — optional filter
 *
 * Returns:
 *   - rankMovements: every student's rank change (overall mean rank A→B)
 *   - teachingGroupShifts: per-subject mean movement by teaching group
 *     (only included for subjects where multiple groups are assigned)
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { computeRankMovement } from "@/modules/assessments/percentageAnalysis";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const { searchParams } = new URL(req.url);
  const fromPointId = searchParams.get("fromPointId");
  const toPointId = searchParams.get("toPointId");
  const yearGroup = searchParams.get("yearGroup") || undefined;

  if (!fromPointId || !toPointId) {
    return NextResponse.json(
      { error: "fromPointId and toPointId are required" },
      { status: 400 }
    );
  }

  const result = await computeRankMovement(
    user.tenantId,
    fromPointId,
    toPointId,
    yearGroup
  );

  if (!result) {
    return NextResponse.json(
      { error: "No percentage/raw assessments found for these points" },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
});
