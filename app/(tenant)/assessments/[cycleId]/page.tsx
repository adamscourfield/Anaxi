import Link from "next/link";
import { notFound } from "next/navigation";
import type { PointType, QualificationType } from "@prisma/client";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { CycleArchiveControl } from "@/components/assessments/CycleArchiveControl";
import { CycleDeleteControl } from "@/components/assessments/CycleDeleteControl";
import { CycleRenameControl } from "@/components/assessments/CycleRenameControl";
import { ResultPointRenameControl } from "@/components/assessments/ResultPointRenameControl";
import { ResultPointStatusControl } from "@/components/assessments/ResultPointStatusControl";
import { formatYearGroup } from "@/lib/yearGroup";
import w from "@/components/assessments/workspace.module.css";
import styles from "./page.module.css";

const POINT_TYPE: Record<PointType, string> = {
  BASELINE: "Baseline",
  INTERNAL_ASSESSMENT: "Internal assessment",
  INTERNAL_MOCK: "Mock",
  TEACHER_PREDICTION: "Teacher prediction",
  EXTERNAL_FINAL: "Final results",
  OTHER: "Other",
};

const QUALIFICATION: Record<QualificationType, string> = {
  GCSE: "GCSE",
  A_LEVEL: "A level",
  PERCENTAGE: "Percentage",
  OTHER: "Other",
};

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

export default async function CycleDetailPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: cycleId, tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: { assessments: { select: { id: true, subject: true, yearGroup: true, _count: { select: { results: true } } } } },
      },
    },
  });
  if (!cycle) notFound();

  const pointIds = cycle.points.map((p) => p.id);
  const [failedChecks, studentRows] = await Promise.all([
    pointIds.length
      ? prisma.assessmentResult.count({ where: { tenantId: user.tenantId, isValid: false, assessment: { pointId: { in: pointIds } } } })
      : 0,
    pointIds.length
      ? prisma.assessmentResult.findMany({
          where: { tenantId: user.tenantId, assessment: { pointId: { in: pointIds } } },
          select: { studentId: true, assessment: { select: { pointId: true } } },
          distinct: ["studentId", "assessmentId"],
        })
      : [],
  ]);
  // Distinct students per point (one result row per student per subject).
  const studentsByPoint = new Map<string, Set<string>>();
  for (const r of studentRows) {
    const set = studentsByPoint.get(r.assessment.pointId) ?? new Set<string>();
    set.add(r.studentId);
    studentsByPoint.set(r.assessment.pointId, set);
  }

  const grades = (p: (typeof cycle.points)[number]) => p.assessments.reduce((s, a) => s + a._count.results, 0);
  const subjects = new Set(cycle.points.flatMap((p) => p.assessments.map((a) => a.subject)));
  const yearGroup = cycle.cohortLabel || formatYearGroup(cycle.points.flatMap((p) => p.assessments.map((a) => a.yearGroup)).find(Boolean));
  const withData = cycle.points.filter((p) => grades(p) > 0);
  const latest = withData.at(-1);
  const compareHref =
    withData.length >= 2 ? `/assessments/${cycle.id}/compare?from=${withData.at(-2)!.id}&to=${withData.at(-1)!.id}` : null;
  const totalGrades = cycle.points.reduce((s, p) => s + grades(p), 0);

  return (
    <div className={styles.page}>
      <AttainmentPageShell>
        <div className={w.page}>
          <AssessmentsBreadcrumb items={[{ label: "Attainment", href: "/assessments" }, { label: cycle.label }]} />
          <PageHeader
            variant="ledger"
            title={cycle.label}
            subtitle={[yearGroup !== "—" ? yearGroup : "", QUALIFICATION[cycle.qualificationType], cycle.academicYear, cycle.isActive ? "" : "Archived"]
              .filter(Boolean)
              .join(" · ")}
            actions={
              <div className={w.actions}>
                {compareHref && (
                  <Link href={compareHref} className={w.buttonSecondary}>
                    Compare {withData.at(-2)!.label} and {withData.at(-1)!.label}
                  </Link>
                )}
                <Link href={`/assessments/${cycle.id}/points/new`} className={w.button}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add result point
                </Link>
              </div>
            }
          />

          <div className={w.summary} style={{ ["--tiles" as string]: 4 }}>
            <div className={w.tile}>
              <span>Result points</span>
              <strong>{cycle.points.length}</strong>
              <p>{withData.length} with grades</p>
            </div>
            <div className={w.tile}>
              <span>Subjects</span>
              <strong>{subjects.size}</strong>
            </div>
            <div className={w.tile}>
              <span>Students</span>
              <strong>{latest ? (studentsByPoint.get(latest.id)?.size ?? 0) : "—"}</strong>
              <p>{latest ? `With grades at ${latest.label}` : "No grades yet"}</p>
            </div>
            <div className={w.tile}>
              <span>Grade checks</span>
              <strong>{totalGrades ? (failedChecks ? failedChecks.toLocaleString("en-GB") : "All passed") : "—"}</strong>
              <p>{totalGrades ? (failedChecks ? `of ${totalGrades.toLocaleString("en-GB")} grades didn't pass` : `${totalGrades.toLocaleString("en-GB")} grades`) : "Checked as they're entered"}</p>
            </div>
          </div>

          <section className={styles.section} aria-labelledby="result-points">
            <div className={w.heading}>
              <div>
                <h2 id="result-points">Result points</h2>
                <p>Each point is one set of results, such as a mock. Status controls whether its grades are used in attainment insights.</p>
              </div>
            </div>

            {cycle.points.length === 0 ? (
              <div className={w.empty}>
                <h2>No result points yet</h2>
                <p>Add a baseline, a mock or final results, then upload or type in the grades.</p>
                <Link href={`/assessments/${cycle.id}/points/new`} className={w.button}>
                  Add the first result point
                </Link>
              </div>
            ) : (
              <div className={w.card}>
                <div className={w.scroll}>
                  <table className={`${w.table} ${styles.points}`}>
                    <thead>
                      <tr>
                        <th>Result point</th>
                        <th>Status</th>
                        <th>Subjects</th>
                        <th className={w.num}>Students</th>
                        <th className={w.num}>Grades</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cycle.points.map((point) => {
                        const count = grades(point);
                        const names = [...new Set(point.assessments.map((a) => a.subject))].sort();
                        const locked = point.resultStatus === "LOCKED";
                        return (
                          <tr key={point.id}>
                            <td>
                              <div className={styles.pointName}>
                                {count ? (
                                  <Link className={w.name} href={`/assessments/${cycle.id}/points/${point.id}`}>
                                    {point.label}
                                  </Link>
                                ) : (
                                  <span className={w.name}>{point.label}</span>
                                )}
                                {user.role === "SUPER_ADMIN" ? <ResultPointRenameControl pointId={point.id} pointLabel={point.label} /> : null}
                              </div>
                              <span className={w.sub}>{[POINT_TYPE[point.pointType], formatDate(point.assessedAt)].filter(Boolean).join(" · ")}</span>
                            </td>
                            <td>
                              <ResultPointStatusControl pointId={point.id} pointLabel={point.label} status={point.resultStatus} />
                            </td>
                            <td className={styles.subjects} title={names.join(", ")}>
                              {names.length ? (
                                <>
                                  {names.slice(0, 3).join(", ")}
                                  {names.length > 3 && <span className={w.muted}> and {names.length - 3} more</span>}
                                </>
                              ) : (
                                <span className={w.muted}>None yet</span>
                              )}
                            </td>
                            <td className={`${w.num} ${w.muted}`}>{count ? studentsByPoint.get(point.id)?.size ?? 0 : "—"}</td>
                            <td className={w.num}>{count ? count.toLocaleString("en-GB") : "—"}</td>
                            <td>
                              <div className={`${w.actions} ${styles.rowActions}`}>
                                {count > 0 && (
                                  <Link className={`${w.buttonSecondary} ${w.small}`} href={`/assessments/${cycle.id}/points/${point.id}`}>
                                    Results
                                  </Link>
                                )}
                                {!locked && (
                                  <>
                                    <Link className={`${w.buttonSecondary} ${w.small}`} href={`/assessments/${cycle.id}/points/${point.id}/enter`}>
                                      Enter grades
                                    </Link>
                                    <Link className={`${w.buttonSecondary} ${w.small}`} href={`/assessments/${cycle.id}/points/${point.id}/upload`}>
                                      Upload
                                    </Link>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className={w.manage} aria-labelledby="manage-cycle">
            <div>
              <h2 id="manage-cycle">Manage this cycle</h2>
              <p>
                {cycle.isActive
                  ? "Archive it at the end of the year to keep it for comparison and take it out of attainment insights."
                  : "Archived: kept for comparison and left out of attainment insights."}
              </p>
            </div>
            <div className={w.actions}>
              {user.role === "SUPER_ADMIN" ? <CycleRenameControl cycleId={cycle.id} cycleLabel={cycle.label} /> : null}
              <CycleArchiveControl cycleId={cycle.id} isActive={cycle.isActive} className={w.buttonSecondary} />
              <CycleDeleteControl cycleId={cycle.id} cycleLabel={cycle.label} className={w.buttonDanger} />
            </div>
          </section>
        </div>
      </AttainmentPageShell>
    </div>
  );
}
