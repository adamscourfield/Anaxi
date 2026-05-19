/**
 * POST /api/assessments/ranking
 *
 * Accepts a multi-subject assessment CSV file (multipart/form-data) and
 * returns each student's parsed scores, optional per-subject ranks, and
 * optional overall rank.
 *
 * Form fields:
 *   file          — required, the CSV file
 *   computeRanks  — optional, "true" (default) | "false"
 *                   Set to "false" to skip rank computation and return scores
 *                   only. Useful for qualitative grade formats (GCSE, A-Level)
 *                   where a numerical rank order is not desired.
 *
 * The CSV must use the layout:
 *   Name | Year Group | Teaching Group | SEN | PP |
 *   [Subject] Score | [Subject] Rank | ... |
 *   Overall Average | Overall Rank
 *
 * Pre-existing rank columns in the CSV are always ignored when ranks are
 * computed — ranks are derived solely from the parsed scores.
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireAssessmentWrite, requireFeature } from "@/lib/guards";
import { parseAndRankAssessmentCsv } from "@/modules/assessments/ranking";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  requireAssessmentWrite(user);

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const csvText = await file.text();

  if (!csvText.trim()) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }

  // computeRanks defaults to true; pass "false" to skip rank computation
  const computeRanks = form.get("computeRanks") !== "false";

  const result = parseAndRankAssessmentCsv(csvText, { computeRanks });

  return NextResponse.json(result, { status: 200 });
});
