import Link from "next/link";
import type { QualificationType } from "@prisma/client";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { getProgress8DashboardSummary } from "@/modules/assessments/progress8";
import { formatYearGroup } from "@/lib/yearGroup";
import w from "@/components/assessments/workspace.module.css";
import { STATUS_CLASS, STATUS_LABEL } from "@/components/assessments/resultStatus";
import styles from "./page.module.css";

const QUALIFICATION: Record<QualificationType, string> = {
  GCSE: "GCSE",
  A_LEVEL: "A level",
  PERCENTAGE: "Percentage",
  OTHER: "Other",
};

type Cycle = Awaited<ReturnType<typeof loadCycles>>[number];

function loadCycles(tenantId: string) {
  return prisma.assessmentCycle.findMany({
    where: { tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: { assessments: { select: { subject: true, yearGroup: true, _count: { select: { results: true } } } } },
      },
    },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });
}

function cycleFacts(cycle: Cycle) {
  const subjects = new Set(cycle.points.flatMap((p) => p.assessments.map((a) => a.subject)));
  const grades = cycle.points.reduce((s, p) => s + p.assessments.reduce((ss, a) => ss + a._count.results, 0), 0);
  const yearGroup = cycle.points.flatMap((p) => p.assessments.map((a) => a.yearGroup)).find(Boolean);
  const latest = [...cycle.points].reverse().find((p) => p.assessments.length > 0) ?? cycle.points.at(-1) ?? null;
  return { subjects: subjects.size, grades, yearGroup: cycle.cohortLabel || (yearGroup ? formatYearGroup(yearGroup) : ""), latest };
}

function CycleTable({ cycles }: { cycles: Cycle[] }) {
  return (
    <div className={w.card}>
      <div className={w.scroll}>
        <table className={`${w.table} ${styles.cycles}`}>
          <thead>
            <tr>
              <th>Cycle</th>
              <th>Year group</th>
              <th>Latest results</th>
              <th className={w.num}>Result points</th>
              <th className={w.num}>Subjects</th>
              <th className={w.num}>Grades entered</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((cycle) => {
              const f = cycleFacts(cycle);
              return (
                <tr key={cycle.id} className={cycle.isActive ? "" : w.archived}>
                  <td>
                    <Link className={w.name} href={`/assessments/${cycle.id}`}>
                      {cycle.label}
                    </Link>
                    <span className={w.sub}>
                      {[QUALIFICATION[cycle.qualificationType], cycle.academicYear].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className={`${w.nowrap} ${w.muted}`}>{f.yearGroup || "—"}</td>
                  <td className={w.nowrap}>
                    {f.latest ? (
                      <>
                        {f.latest.label}
                        <span className={w.sub}>
                          <span className={`${w.status} ${STATUS_CLASS[f.latest.resultStatus]}`}>{STATUS_LABEL[f.latest.resultStatus]}</span>
                        </span>
                      </>
                    ) : (
                      <span className={w.muted}>No result points yet</span>
                    )}
                  </td>
                  <td className={`${w.num} ${w.muted}`}>{cycle.points.length}</td>
                  <td className={`${w.num} ${w.muted}`}>{f.subjects}</td>
                  <td className={w.num}>{f.grades ? f.grades.toLocaleString("en-GB") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AssessmentsPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const [cycles, p8] = await Promise.all([loadCycles(user.tenantId), getProgress8DashboardSummary(user.tenantId)]);
  const active = cycles.filter((c) => c.isActive);
  const archived = cycles.filter((c) => !c.isActive);
  const gradesActive = active.reduce((s, c) => s + cycleFacts(c).grades, 0);
  const p8Value = p8?.averagePredictedProgress8 ?? null;

  return (
    <div className={styles.page}>
      <AttainmentPageShell>
        <div className={w.page}>
          <PageHeader
            variant="ledger"
            title="Attainment"
            subtitle="Each cycle follows one year group's results through the year, from the first assessment to final grades."
            actions={
              <Link href="/assessments/new" className={w.button}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New cycle
              </Link>
            }
          />

          {cycles.length === 0 ? (
            <div className={w.empty}>
              <h2>No cycles yet</h2>
              <p>Create a cycle for a year group, add its result points (mocks, assessments), then upload or type in the grades.</p>
              <Link href="/assessments/new" className={w.button}>
                Create the first cycle
              </Link>
            </div>
          ) : (
            <>
              <div className={w.summary}>
                <div className={w.tile}>
                  <span>Active cycles</span>
                  <strong>{active.length}</strong>
                  {archived.length > 0 && <p>{archived.length} archived</p>}
                </div>
                <div className={w.tile}>
                  <span>Grades entered</span>
                  <strong>{gradesActive.toLocaleString("en-GB")}</strong>
                  <p>Across active cycles</p>
                </div>
                <div className={w.tile}>
                  <span>Predicted Progress 8</span>
                  <strong>{p8Value === null ? "—" : `${p8Value > 0 ? "+" : p8Value < 0 ? "−" : ""}${Math.abs(p8Value).toFixed(2)}`}</strong>
                  <p>
                    {p8
                      ? `${p8.cycleLabel}, ${p8.pointLabel} · ${p8.studentCountWithPrediction} students with KS2 data`
                      : "Needs a GCSE cycle with published results"}
                  </p>
                </div>
              </div>

              {active.length > 0 && (
                <section className={styles.section} aria-labelledby="active-cycles">
                  <div className={w.heading}>
                    <h2 id="active-cycles">Active cycles</h2>
                  </div>
                  <CycleTable cycles={active} />
                </section>
              )}
              {archived.length > 0 && (
                <section className={styles.section} aria-labelledby="archived-cycles">
                  <div className={w.heading}>
                    <h2 id="archived-cycles">Archived</h2>
                    <p>Kept for comparison. Archived cycles don&apos;t appear in attainment insights.</p>
                  </div>
                  <CycleTable cycles={archived} />
                </section>
              )}
              <p className={w.note}>
                Predicted Progress 8 compares each student&apos;s grades at that result point with the Attainment 8 expected for students
                with the same KS2 scores. It is an estimate from in-school results, not an official figure.
              </p>
            </>
          )}
        </div>
      </AttainmentPageShell>
    </div>
  );
}
