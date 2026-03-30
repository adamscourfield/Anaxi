import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { displayGrade } from "@/modules/assessments/gradeNormalizer";
import Link from "next/link";

const FORMAT_LABELS = {
  GCSE: "GCSE 1–9",
  A_LEVEL: "A Level",
  PERCENTAGE: "Percentage",
  RAW: "Raw score",
} as const;

const STATUS_BADGE: Record<string, string> = {
  PRESENT: "",
  ABSENT: "rounded-full bg-muted/20 px-2 py-0.5 text-xs text-muted",
  WITHDRAWN: "rounded-full bg-muted/20 px-2 py-0.5 text-xs text-muted",
};

export default async function AssessmentResultsPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  const user = await getSessionUserOrThrow();
  const { assessmentId } = params;

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, tenantId: user.tenantId },
    include: {
      point: { include: { cycle: true } },
    },
  });
  if (!assessment) notFound();

  const results = await prisma.assessmentResult.findMany({
    where: { tenantId: user.tenantId, assessmentId },
    include: {
      student: {
        select: { id: true, fullName: true, yearGroup: true, upn: true, sendFlag: true, ppFlag: true },
      },
    },
    orderBy: [{ normalizedScore: "desc" }],
  });

  const present = results.filter((r) => r.status === "PRESENT");
  const scores = present
    .map((r) => r.normalizedScore)
    .filter((s): s is number => s !== null);
  const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  // Distribution — 4 buckets
  const buckets = [
    { label: "High", min: 0.75, count: 0 },
    { label: "Mid-high", min: 0.5, count: 0 },
    { label: "Mid-low", min: 0.25, count: 0 },
    { label: "Low", min: 0, count: 0 },
  ];
  for (const score of scores) {
    if (score >= 0.75) buckets[0].count++;
    else if (score >= 0.5) buckets[1].count++;
    else if (score >= 0.25) buckets[2].count++;
    else buckets[3].count++;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={assessment.title}
          subtitle={`${assessment.subject} · ${assessment.yearGroup} · ${assessment.point.cycle.label} / ${assessment.point.label} · ${FORMAT_LABELS[assessment.gradeFormat]}`}
        />
        <Link
          href={`/assessments/results/${assessmentId}`}
          className="text-sm text-accent"
        >
          ← Back
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Students</p>
          <p className="text-xl font-semibold text-text">{results.length}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Present</p>
          <p className="text-xl font-semibold text-text">{present.length}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Mean grade</p>
          <p className="text-xl font-semibold text-text">
            {mean !== null
              ? displayGrade(mean, assessment.gradeFormat, assessment.maxScore)
              : "—"}
          </p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Absent / withdrawn</p>
          <p className="text-xl font-semibold text-text">
            {results.filter((r) => r.status !== "PRESENT").length}
          </p>
        </Card>
      </div>

      {/* Distribution bar */}
      {scores.length > 0 && (
        <Card className="space-y-3">
          <SectionHeader title="Grade distribution" />
          <div className="flex gap-1 rounded-lg overflow-hidden h-8">
            {buckets.map((b) => {
              const pct = scores.length > 0 ? (b.count / scores.length) * 100 : 0;
              if (pct === 0) return null;
              const colors = ["bg-success", "bg-accent/60", "bg-warning/60", "bg-error/60"];
              return (
                <div
                  key={b.label}
                  title={`${b.label}: ${b.count} students (${Math.round(pct)}%)`}
                  className={`${colors[buckets.indexOf(b)]} flex items-center justify-center text-xs text-white font-medium`}
                  style={{ width: `${pct}%` }}
                >
                  {pct > 8 && `${Math.round(pct)}%`}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 text-xs text-muted">
            {buckets.map((b, i) => (
              <span key={b.label}>
                {b.label}: {b.count}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Results table */}
      <Card>
        <SectionHeader title="All results" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/60 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2 text-right">Grade</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/analysis/students/${r.studentId}`}
                      className="font-medium text-text hover:text-accent"
                    >
                      {r.student.fullName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{r.student.yearGroup ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="flex gap-1">
                      {r.student.sendFlag && (
                        <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          SEND
                        </span>
                      )}
                      {r.student.ppFlag && (
                        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          PP
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {r.status === "PRESENT" && r.normalizedScore !== null
                      ? displayGrade(r.normalizedScore, assessment.gradeFormat, assessment.maxScore)
                      : r.rawValue}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.status !== "PRESENT" && (
                      <span className={STATUS_BADGE[r.status]}>{r.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
