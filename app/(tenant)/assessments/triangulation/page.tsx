import { getSessionUserOrThrow } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { H2, MetaText } from "@/components/ui/typography";
import { computeTriangulatedRisks } from "@/modules/assessments/analysis";
import { displayGrade } from "@/modules/assessments/gradeNormalizer";
import Link from "next/link";

const BAND_PILL: Record<string, string> = {
  URGENT:   "bg-risk-urgent-bg text-risk-urgent-text",
  PRIORITY: "bg-scale-some-light text-scale-some-text",
};

const BAND_LABELS: Record<string, string> = {
  URGENT: "Urgent",
  PRIORITY: "Priority",
};

export default async function TriangulationPage({
  searchParams,
}: {
  searchParams?: Record<string, string | undefined>;
}) {
  const user = await getSessionUserOrThrow();

  const windowDays = Number(searchParams?.window ?? "21");
  const threshold = Number(searchParams?.threshold ?? "0.5");

  const { students, meta, computedAt } = await computeTriangulatedRisks(
    user.tenantId,
    user.id,
    windowDays,
    threshold
  );

  // Optional filters from query params
  const yearFilter = searchParams?.yearGroup ?? "";
  const bandFilter = searchParams?.band ?? "";

  const filtered = students.filter((s) => {
    if (yearFilter && s.yearGroup !== yearFilter) return false;
    if (bandFilter && s.behaviouralBand !== bandFilter) return false;
    return true;
  });

  // Unique year groups for filter UI
  const yearGroups = [...new Set(students.map((s) => s.yearGroup).filter(Boolean))].sort();

  const computedAtStr = computedAt.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.02em] text-text">
              Triangulated Risk
            </h1>
            <MetaText>
              Students with both behavioural concern and low attainment · Updated {computedAtStr}
            </MetaText>
          </div>
          <Link href="/assessments" className="text-sm text-muted hover:underline">
            ← Assessments
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Dual-flagged students</p>
          <p className="text-3xl font-bold text-text">{meta.total}</p>
          <p className="text-xs text-muted">Below {Math.round(meta.attainmentThreshold * 100)}% normalised + behavioural concern</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Urgent</p>
          <p className="text-3xl font-bold text-risk-urgent-text">{meta.urgent}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Priority</p>
          <p className="text-3xl font-bold text-scale-some-text">{meta.priority}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Filter:</span>

        {/* Year group */}
        <div className="segmented-toggle">
          <Link
            href={`/assessments/triangulation?window=${windowDays}&threshold=${threshold}`}
            className={`segmented-toggle-btn ${!yearFilter ? "segmented-toggle-btn-active" : ""}`}
          >
            All years
          </Link>
          {yearGroups.map((yg) => (
            <Link
              key={yg}
              href={`/assessments/triangulation?window=${windowDays}&threshold=${threshold}&yearGroup=${encodeURIComponent(yg!)}`}
              className={`segmented-toggle-btn ${yearFilter === yg ? "segmented-toggle-btn-active" : ""}`}
            >
              {yg}
            </Link>
          ))}
        </div>

        {/* Band */}
        <div className="segmented-toggle">
          {["URGENT", "PRIORITY"].map((band) => (
            <Link
              key={band}
              href={`/assessments/triangulation?window=${windowDays}&threshold=${threshold}${yearFilter ? `&yearGroup=${encodeURIComponent(yearFilter)}` : ""}&band=${band}`}
              className={`segmented-toggle-btn ${bandFilter === band ? "segmented-toggle-btn-active" : ""}`}
            >
              {BAND_LABELS[band]}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-muted">
            {meta.total === 0
              ? "No students are currently flagged on both signals."
              : "No students match the current filters."}
          </p>
          {meta.total === 0 && (
            <p className="mt-1 text-sm text-muted">
              Make sure assessment data has been uploaded for the active cycle and behavioural snapshots are current.
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <div className="mb-4 border-b border-border pb-3 flex items-center justify-between">
            <H2>Students ({filtered.length})</H2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-4">Student</th>
                  <th className="pb-2 pr-4">Year</th>
                  <th className="pb-2 pr-4">Band</th>
                  <th className="pb-2 pr-4">Behavioural drivers</th>
                  <th className="pb-2">Attainment concerns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filtered.map((student) => {
                  // Show only results below threshold
                  const flaggedResults = student.attainmentResults.filter(
                    (r) => r.normalizedScore !== null && r.normalizedScore < threshold
                  );

                  return (
                    <tr key={student.studentId} className="align-top">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/analysis/students/${student.studentId}`}
                          className="font-medium text-text hover:text-accent"
                        >
                          {student.studentName}
                        </Link>
                        <div className="mt-0.5 flex gap-1">
                          {student.sendFlag && (
                            <span className="rounded-full bg-cat-violet-bg px-1.5 py-0.5 text-[9px] font-medium text-cat-violet-text">SEND</span>
                          )}
                          {student.ppFlag && (
                            <span className="rounded-full bg-scale-consistent-light px-1.5 py-0.5 text-[9px] font-medium text-blue-700">PP</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted">{student.yearGroup ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BAND_PILL[student.behaviouralBand]}`}>
                          {BAND_LABELS[student.behaviouralBand]}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {student.behaviouralDrivers.map((d) => (
                            <span
                              key={d.metric}
                              className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] text-muted"
                            >
                              {d.label}
                            </span>
                          ))}
                          {student.behaviouralDrivers.length === 0 && (
                            <span className="text-xs text-muted">Score: {student.behaviouralScore}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="space-y-1">
                          {flaggedResults.map((r) => (
                            <div key={r.subject} className="flex items-center gap-2">
                              <span className="text-text">{r.subject}</span>
                              <span className="font-semibold text-error">
                                {displayGrade(r.normalizedScore!, r.gradeFormat, r.maxScore)}
                              </span>
                              <span className="text-xs text-muted">{r.pointLabel}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Window selector footnote */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Behavioural window:</span>
        {[7, 21, 28].map((w) => (
          <Link
            key={w}
            href={`/assessments/triangulation?window=${w}&threshold=${threshold}${yearFilter ? `&yearGroup=${encodeURIComponent(yearFilter)}` : ""}${bandFilter ? `&band=${bandFilter}` : ""}`}
            className={`rounded px-2 py-0.5 ${windowDays === w ? "bg-accent/10 text-accent font-medium" : "hover:text-text"}`}
          >
            {w}d
          </Link>
        ))}
      </div>
    </div>
  );
}
