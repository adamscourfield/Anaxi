import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { buildViewerContext } from "@/lib/viewerContext";
import { Avatar } from "@/components/ui/avatar";
import {
  AttainmentEvidenceShell,
  EvidenceEmpty,
  EvidencePagination,
  evidenceHref,
  evidenceStyles as s,
} from "@/components/insights/attainment-evidence";
import { canViewExplorer, canViewAssessmentExplorer, canExportExplorer } from "@/modules/authz";
import {
  computeAssessmentAnalysis,
  type AssessmentStudentRow,
  type MovementLabel,
} from "@/modules/analysis/assessmentAnalysis";
import { resolveAttainmentCycle } from "@/modules/analysis/attainmentCycle";
import { average, formatIndex } from "@/modules/analysis/attainmentFormat";
import { compareYearGroups, formatYearGroup } from "@/lib/yearGroup";

const PER_PAGE = 25;

const MOVEMENT: Record<MovementLabel, { label: string; className: string }> = {
  IMPROVING: { label: "Improving", className: s.positive },
  DECLINING: { label: "Declining", className: s.concern },
  STABLE: { label: "Stable", className: s.muted },
  NO_PRIOR: { label: "No previous result", className: s.muted },
};

/** Overall direction across a student's subjects (average change, ±2 index points counts as stable). */
function overallMovement(row: AssessmentStudentRow): MovementLabel {
  const avg = average(row.subjects.map((sub) => sub.movement));
  if (avg === null) return "NO_PRIOR";
  if (avg > 0.02) return "IMPROVING";
  if (avg < -0.02) return "DECLINING";
  return "STABLE";
}

function ks2Average(row: AssessmentStudentRow): string {
  const avg = average([row.ks2MathsScaledScore, row.ks2ReadingScaledScore]);
  if (avg === null) return "—";
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function AssessmentStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");
  const viewer = await buildViewerContext(user);
  if (!canViewExplorer(viewer) || !canViewAssessmentExplorer(viewer)) notFound();

  const search = one(params.q).trim();
  const yearGroup = one(params.yearGroup);
  const movement = one(params.movement);
  const send = one(params.send) === "1";
  const pp = one(params.pp) === "1";

  const { cycles, selected } = await resolveAttainmentCycle(user.tenantId, one(params.cycle));
  const analysis = selected ? await computeAssessmentAnalysis(user.tenantId, { cycleId: selected.id }) : null;
  const students = analysis?.students ?? [];

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = students
    .filter((r) => words.every((w) => r.studentName.toLowerCase().includes(w)))
    .filter((r) => !yearGroup || r.yearGroup === yearGroup)
    .filter((r) => !movement || overallMovement(r) === movement)
    .filter((r) => !send || r.sendFlag)
    .filter((r) => !pp || r.ppFlag)
    .sort((a, b) => {
      // Largest single-subject drop first, then higher overall mean.
      const worstA = Math.min(0, ...a.subjects.map((x) => x.movement ?? 0));
      const worstB = Math.min(0, ...b.subjects.map((x) => x.movement ?? 0));
      if (Math.abs(worstA - worstB) > 0.001) return worstA - worstB;
      return (b.overallMean ?? 0) - (a.overallMean ?? 0);
    });

  const yearGroups = Array.from(new Set(students.map((r) => r.yearGroup).filter((y): y is string => Boolean(y)))).sort(compareYearGroups);
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pageCount, Math.max(1, Number.parseInt(one(params.page), 10) || 1));
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const filters = {
    cycle: selected?.id,
    q: search || undefined,
    yearGroup: yearGroup || undefined,
    movement: movement || undefined,
    send: send ? "1" : undefined,
    pp: pp ? "1" : undefined,
  };
  const pageHref = (p: number) => evidenceHref("students", { ...filters, page: p > 1 ? String(p) : undefined });
  const from = encodeURIComponent(pageHref(page));
  const hasFilters = Boolean(search || yearGroup || movement || send || pp);

  const declining = students.filter((r) => overallMovement(r) === "DECLINING");

  return (
    <AttainmentEvidenceShell
      page="students"
      title="Student results"
      subtitle="Every student with results in this cycle: their mean, how they've moved since the previous result point, and subjects well above or below their own average."
      cycles={cycles}
      selected={selected}
      cycleHref={(id) => evidenceHref("students", { ...filters, cycle: id })}
      exportView={canExportExplorer(viewer) ? "ASSESSMENT_STUDENTS" : undefined}
    >
      {!selected || !students.length ? (
        <EvidenceEmpty
          title="No results to show"
          body={selected ? "This cycle has no validated, published or locked results yet." : "Set up an assessment cycle to see student results."}
        />
      ) : (
        <>
          <div className={s.summary}>
            <div className={s.tile}><span>Students with results</span><strong>{students.length}</strong></div>
            <div className={s.tile}><span>Declining overall</span><strong>{declining.length}</strong><p>Average change below −2 points</p></div>
            <div className={s.tile}><span>Improving overall</span><strong>{students.filter((r) => overallMovement(r) === "IMPROVING").length}</strong><p>Average change above +2 points</p></div>
            <div className={s.tile}><span>SEND, declining overall</span><strong>{declining.filter((r) => r.sendFlag).length}</strong><p>of {students.filter((r) => r.sendFlag).length} SEND students</p></div>
          </div>

          <section className={s.controls} aria-label="Filter students">
            <form method="GET">
              <input type="hidden" name="cycle" value={selected.id} />
              <label className={s.field}>
                Student name
                <input type="search" name="q" defaultValue={search} placeholder="Find a student…" />
              </label>
              <label className={s.field}>
                Year group
                <select name="yearGroup" defaultValue={yearGroup}>
                  <option value="">All year groups</option>
                  {yearGroups.map((yg) => <option key={yg} value={yg}>{formatYearGroup(yg)}</option>)}
                </select>
              </label>
              <label className={s.field}>
                Overall movement
                <select name="movement" defaultValue={movement}>
                  <option value="">All</option>
                  <option value="DECLINING">Declining</option>
                  <option value="STABLE">Stable</option>
                  <option value="IMPROVING">Improving</option>
                  <option value="NO_PRIOR">No previous result</option>
                </select>
              </label>
              <label className={s.check}><input type="checkbox" name="send" value="1" defaultChecked={send} /> SEND only</label>
              <label className={s.check}><input type="checkbox" name="pp" value="1" defaultChecked={pp} /> Pupil premium only</label>
              <button type="submit">Apply</button>
              {hasFilters && <Link className={s.clear} href={evidenceHref("students", { cycle: selected.id })}>Clear</Link>}
            </form>
          </section>

          <div className={s.heading}>
            <h2>Students</h2>
            <span>{rows.length} {rows.length === 1 ? "student" : "students"} · largest single-subject drop first</span>
          </div>

          {!rows.length ? (
            <EvidenceEmpty title="No students match these filters" body="Try a different name, year group or movement." />
          ) : (
            <div className={s.card}>
              <div className={s.scroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Year</th>
                      <th className={s.num} title="Average of KS2 maths and reading scaled scores, where known">KS2 average</th>
                      <th className={s.num} title="Mean normalised score on a 0–100 index">Mean</th>
                      <th>Movement</th>
                      <th>Subjects</th>
                      <th>Outliers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const mv = MOVEMENT[overallMovement(row)];
                      const subjects = Array.from(new Set(row.subjects.map((x) => x.subject)));
                      const flags = [row.sendFlag && "SEND", row.ppFlag && "Pupil premium"].filter(Boolean).join(" · ");
                      return (
                        <tr key={row.studentId}>
                          <td>
                            <div className={s.person}>
                              <Avatar name={row.studentName} studentId={row.studentId} size="sm" tone="muted" />
                              <span>
                                <Link href={`/students/${row.studentId}?from=${from}#attainment`}>{row.studentName}</Link>
                                {flags && <span className={s.sub}>{flags}</span>}
                              </span>
                            </div>
                          </td>
                          <td className={`${s.nowrap} ${s.muted}`}>{formatYearGroup(row.yearGroup)}</td>
                          <td className={`${s.num} ${s.muted}`}>{ks2Average(row)}</td>
                          <td className={`${s.num} ${s.strong}`}>{formatIndex(row.overallMean)}</td>
                          <td className={`${s.nowrap} ${mv.className}`}>{mv.label}</td>
                          <td className={s.subjects}>
                            {subjects.slice(0, 3).join(", ")}
                            {subjects.length > 3 && ` and ${subjects.length - 3} more`}
                          </td>
                          <td>
                            {row.outliers.length ? (
                              <div className={s.tags}>
                                {[...row.outliers].sort((a, b) => a.zScore - b.zScore).map((o) => (
                                  <span
                                    key={o.subject}
                                    className={`${s.tag} ${o.direction === "UNDER" ? s.down : s.up}`}
                                    title={`${o.direction === "UNDER" ? "Well below" : "Well above"} this student's average (z = ${o.zScore.toFixed(2)})`}
                                  >
                                    {o.direction === "UNDER" ? "↓" : "↑"} {o.subject}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={s.muted}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <EvidencePagination page={page} pageCount={pageCount} total={rows.length} perPage={PER_PAGE} itemLabel="students" href={pageHref} />
            </div>
          )}
          <p className={s.note}>
            Mean is a 0–100 index that puts different grade scales on one footing; it is not a percentage. Movement compares
            {analysis?.cycles[0]?.previousPointLabel ? ` ${analysis.cycles[0].previousPointLabel} with ${analysis.cycles[0].currentPointLabel}` : " the two most recent result points"}. An outlier is a subject at least one standard deviation from the student&apos;s own average.
          </p>
        </>
      )}
    </AttainmentEvidenceShell>
  );
}
