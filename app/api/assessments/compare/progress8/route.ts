import { type NextRequest, NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { getProgress8ForPoint } from "@/modules/assessments/progress8";
import { apiErrorResponse } from "@/lib/apiErrors";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUserOrThrow();
    await requireFeature(user.tenantId, "ASSESSMENTS");
    const fromPointId = req.nextUrl.searchParams.get("fromPointId");
    const toPointId = req.nextUrl.searchParams.get("toPointId");
    if (!fromPointId || !toPointId) {
      return NextResponse.json({ error: "fromPointId and toPointId are required" }, { status: 400 });
    }

    const [fromData, toData] = await Promise.all([
      getProgress8ForPoint(fromPointId, user.tenantId),
      getProgress8ForPoint(toPointId, user.tenantId),
    ]);

    if (!fromData.applicable || !toData.applicable) {
      return NextResponse.json({ applicable: false });
    }

    // Build per-student delta lookup
    const fromByStudent = new Map(fromData.students.map((s) => [s.studentId, s]));
    const toByStudent = new Map(toData.students.map((s) => [s.studentId, s]));
    const allStudentIds = [...new Set([...fromByStudent.keys(), ...toByStudent.keys()])];

    const students = allStudentIds.map((id) => {
      const f = fromByStudent.get(id);
      const t = toByStudent.get(id);
      const ref = f ?? t!;
      const fromP8 = f?.p8 ?? null;
      const toP8 = t?.p8 ?? null;
      const delta = fromP8 !== null && toP8 !== null ? Math.round((toP8 - fromP8) * 100) / 100 : null;
      return {
        studentId: id,
        name: ref.name,
        yearGroup: ref.yearGroup,
        ppFlag: ref.ppFlag,
        sendFlag: ref.sendFlag,
        fromP8,
        toP8,
        delta,
      };
    });

    students.sort((a, b) => {
      if (a.delta === null && b.delta === null) return 0;
      if (a.delta === null) return 1;
      if (b.delta === null) return -1;
      return b.delta - a.delta;
    });

    return NextResponse.json({
      applicable: true,
      fromSummary: fromData.cohort,
      toSummary: toData.cohort,
      fromPpSummary: fromData.ppSummary,
      toPpSummary: toData.ppSummary,
      fromSendSummary: fromData.sendSummary,
      toSendSummary: toData.sendSummary,
      students,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
