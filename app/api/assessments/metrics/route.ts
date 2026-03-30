import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  computeThresholdMetric,
  computeCombinedMetric,
  aggregateByDimension,
} from "@/modules/assessments/metrics";
import type { MetricRule, AggregationDimension } from "@/modules/assessments/metrics";

/**
 * GET /api/assessments/metrics
 *
 * Query params:
 *   type: "threshold" | "combined" | "aggregate"
 *
 * For threshold:
 *   assessmentId, threshold, operator?
 *
 * For combined:
 *   pointId, presetId? (or rulesJson inline), logic?
 *
 * For aggregate:
 *   assessmentId, dimension, threshold?
 */
export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "threshold") {
    const assessmentId = searchParams.get("assessmentId");
    const threshold = searchParams.get("threshold");
    const operator = (searchParams.get("operator") || "gte") as "gte" | "gt" | "lte" | "lt";

    if (!assessmentId || !threshold) {
      return NextResponse.json({ error: "assessmentId and threshold are required" }, { status: 400 });
    }

    const result = await computeThresholdMetric(
      user.tenantId,
      assessmentId,
      threshold,
      operator
    );
    if (!result) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    return NextResponse.json({ metric: result });
  }

  if (type === "combined") {
    const pointId = searchParams.get("pointId");
    const presetId = searchParams.get("presetId");
    const rulesJsonRaw = searchParams.get("rulesJson");
    const logic = (searchParams.get("logic") || "AND") as "AND" | "OR";

    if (!pointId) {
      return NextResponse.json({ error: "pointId is required" }, { status: 400 });
    }

    let rules: MetricRule[];
    let presetName: string | undefined;

    if (presetId) {
      const preset = await prisma.attainmentMetricPreset.findFirst({
        where: { id: presetId, tenantId: user.tenantId },
      });
      if (!preset) return NextResponse.json({ error: "Preset not found" }, { status: 404 });
      rules = preset.rulesJson as MetricRule[];
      presetName = preset.name;
    } else if (rulesJsonRaw) {
      rules = JSON.parse(rulesJsonRaw) as MetricRule[];
    } else {
      return NextResponse.json({ error: "Either presetId or rulesJson is required" }, { status: 400 });
    }

    // Verify point belongs to tenant
    const point = await prisma.assessmentPoint.findFirst({
      where: { id: pointId, tenantId: user.tenantId },
    });
    if (!point) return NextResponse.json({ error: "Point not found" }, { status: 404 });

    const result = await computeCombinedMetric(user.tenantId, pointId, rules, logic, presetName);
    if (!result) return NextResponse.json({ error: "No data" }, { status: 404 });

    return NextResponse.json({ metric: result });
  }

  if (type === "aggregate") {
    const assessmentId = searchParams.get("assessmentId");
    const dimension = searchParams.get("dimension") as AggregationDimension | null;
    const threshold = searchParams.get("threshold") || undefined;

    if (!assessmentId || !dimension) {
      return NextResponse.json({ error: "assessmentId and dimension are required" }, { status: 400 });
    }

    const result = await aggregateByDimension(
      user.tenantId,
      assessmentId,
      dimension,
      threshold
    );

    return NextResponse.json({ aggregations: result });
  }

  return NextResponse.json({ error: "type must be one of: threshold, combined, aggregate" }, { status: 400 });
}
