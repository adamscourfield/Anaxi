/**
 * POST /api/assessments/ranking
 *
 * Accepts a multi-subject assessment CSV file (multipart/form-data, field "file")
 * and returns each student's computed per-subject ranks and overall rank.
 *
 * The CSV must use the layout:
 *   Name | Year Group | Teaching Group | SEN | PP |
 *   [Subject] Score | [Subject] Rank | ... |
 *   Overall Average | Overall Rank
 *
 * Pre-existing rank columns in the CSV are ignored — all ranks are recomputed.
 */

import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { parseAndRankAssessmentCsv } from "@/modules/assessments/ranking";

export async function POST(req: Request) {
  await getSessionUserOrThrow();

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const csvText = await file.text();

  if (!csvText.trim()) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }

  const result = parseAndRankAssessmentCsv(csvText);

  return NextResponse.json(result, { status: 200 });
}
