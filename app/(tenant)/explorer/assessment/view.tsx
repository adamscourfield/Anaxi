import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { buildViewerContext } from "@/lib/viewerContext";
import {
  AttainmentEvidenceShell,
  EvidenceEmpty,
  evidenceHref,
  evidenceStyles as s,
} from "@/components/insights/attainment-evidence";
import { canViewExplorer, canViewAssessmentExplorer } from "@/modules/authz";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";
import { computeAttainmentBehaviourCorrelation } from "@/modules/analysis/attainmentBehaviourCorrelation";
import { resolveAttainmentCycle } from "@/modules/analysis/attainmentCycle";
import { filterVisibleTeachers, visibleAttainmentTeacherIds } from "@/modules/analysis/attainmentScope";
import { average, changeTone, formatIndexChange, formatIndexPoints } from "@/modules/analysis/attainmentFormat";
import { parseWindow, VALID_WINDOWS } from "@/lib/explorerUtils";
import { formatYearGroup } from "@/lib/yearGroup";
import { isDownInSeveralSubjects } from "@/modules/analysis/attainmentConcern";
import correlationStyles from "./assessment.module.css";

const RAPID_DROP = -0.08;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function strengthLabel(strength: string): string {
  return strength.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default async function AssessmentHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");
  const viewer = await buildViewerContext(user);
  if (!canViewExplorer(viewer) || !canViewAssessmentExplorer(viewer)) notFound();

  const windowDays = parseWindow(one(params.windowDays) || undefined);
  const { cycles, selected } = await resolveAttainmentCycle(user.tenantId, one(params.cycle));
  const [analysis, correlation, visible] = await Promise.all([
    selected ? computeAssessmentAnalysis(user.tenantId, { cycleId: selected.id }) : null,
    computeAttainmentBehaviourCorrelation(user.tenantId, windowDays),
    visibleAttainmentTeacherIds(user.tenantId, viewer),
  ]);

  const students = analysis?.students ?? [];
  const teachers = filterVisibleTeachers(analysis?.teachers ?? [], visible);
  const cohorts = analysis?.cohorts ?? [];
  const meta = analysis?.cycles[0];
  const cycleParam = selected?.id;
  const windowParam = windowDays === 21 ? undefined : String(windowDays);

  const downInSeveral = students.filter(isDownInSeveralSubjects);
  const belowExpected = teachers
    .filter((t) => changeTone(t.overallValueAdd) === "concern")
    .sort((a, b) => (a.overallValueAdd ?? 0) - (b.overallValueAdd ?? 0));
  const rapidDrops = students
    .map((st) => ({ st, drops: st.subjects.filter((sub) => sub.movement !== null && sub.movement <= RAPID_DROP) }))
    .filter((x) => x.drops.length > 0)
    .sort((a, b) => Math.min(...a.drops.map((d) => d.movement!)) - Math.min(...b.drops.map((d) => d.movement!)));
  const sendGap = average(cohorts.map((c) => c.sendGap));
  const ppGap = average(cohorts.map((c) => c.ppGap));
  const strong = correlation.schoolWide
    .filter((r) => Math.abs(r.correlation) >= 0.3 && r.confidence === "HIGH")
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, 4);
  const from = encodeURIComponent(evidenceHref("analysis", { cycle: cycleParam, windowDays: windowParam }));

  return (
    <AttainmentEvidenceShell
      page="analysis"
      title="Attainment analysis"
      subtitle="The headline figures for one assessment cycle, where to look first, and how attainment lines up with behaviour."
      cycles={cycles}
      selected={selected}
      cycleHref={(id) => evidenceHref("analysis", { cycle: id, windowDays: windowParam })}
    >
      {!selected || !students.length ? (
        <EvidenceEmpty
          title="No results to analyse"
          body={selected ? "This cycle has no published or locked results yet." : "Set up an assessment cycle to see attainment analysis."}
        />
      ) : (
        <>
          {meta && (
            <p className={s.note}>
              {meta.previousPointLabel ? `Comparing ${meta.previousPointLabel} with ${meta.currentPointLabel}.` : `${meta.currentPointLabel} only; there is no earlier result point to compare with yet.`}
            </p>
          )}
          <div className={s.summary}>
            <Link className={s.tile} href={evidenceHref("students", { cycle: cycleParam })}>
              <span>Students with results</span><strong>{students.length}</strong>
            </Link>
            <Link className={s.tile} href={`/insights/attainment?view=students&movement=SEVERAL_DOWN&cycle=${cycleParam}`}>
              <span>Down in 3 or more subjects</span><strong>{downInSeveral.length}</strong><p>10+ points (a grade or more at GCSE) in each</p>
            </Link>
            <Link className={s.tile} href={evidenceHref("groups", { cycle: cycleParam, view: "sendGap" })}>
              <span>SEND gap</span><strong>{formatIndexChange(sendGap)}</strong>
              <p>{students.filter((x) => x.sendFlag).length} SEND, {students.filter((x) => !x.sendFlag).length} other students</p>
            </Link>
            <Link className={s.tile} href={evidenceHref("groups", { cycle: cycleParam, view: "ppGap" })}>
              <span>Pupil premium gap</span><strong>{formatIndexChange(ppGap)}</strong>
              <p>{students.filter((x) => x.ppFlag).length} pupil premium, {students.filter((x) => !x.ppFlag).length} other students</p>
            </Link>
          </div>
          <p className={s.note}>Gaps are averaged across year and subject groups, in points on the 0–100 index. A positive gap means the SEND or pupil premium students scored lower.</p>

          <div className={s.grid2}>
            <section className={s.card} aria-labelledby="below-expected">
              <div className={s.cardHead}>
                <div>
                  <h3 id="below-expected">Teachers below expected</h3>
                  <p>Value-added of −5 points or lower against students&apos; prior attainment</p>
                </div>
                <Link href={evidenceHref("teachers", { cycle: cycleParam })}>All teachers →</Link>
              </div>
              {belowExpected.length ? (
                <div className={s.list}>
                  {belowExpected.slice(0, 5).map((t) => (
                    <div className={s.item} key={t.teacherId}>
                      <div>
                        <h4>{t.teacherName}</h4>
                        <p>{[t.departmentNames[0], Array.from(new Set(t.subjects.map((x) => x.subject))).join(", ")].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className={s.concern}>{formatIndexPoints(t.overallValueAdd)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={s.empty}>
                  {teachers.length
                    ? `None of the ${teachers.length} teachers with results is 5 or more points below expected. Average value-added is ${formatIndexPoints(average(teachers.map((t) => t.overallValueAdd)))}.`
                    : "No results in this cycle are linked to teachers you can see."}
                </p>
              )}
            </section>

            <section className={s.card} aria-labelledby="largest-drops">
              <div className={s.cardHead}>
                <div>
                  <h3 id="largest-drops">Largest drops</h3>
                  <p>Students down 8 or more points in at least one subject</p>
                </div>
                <Link href={evidenceHref("students", { cycle: cycleParam })}>All students →</Link>
              </div>
              {rapidDrops.length ? (
                <div className={s.list}>
                  {rapidDrops.slice(0, 5).map(({ st, drops }) => (
                    <Link className={s.item} key={st.studentId} href={`/students/${st.studentId}?from=${from}#attainment`}>
                      <div>
                        <h4>{st.studentName}</h4>
                        <p>{[formatYearGroup(st.yearGroup), st.sendFlag && "SEND", st.ppFlag && "Pupil premium", drops.map((d) => d.subject).join(", ")].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className={s.concern}>{drops.length} {drops.length === 1 ? "subject" : "subjects"}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className={s.empty}>No student dropped 8 or more points in any subject.</p>
              )}
            </section>
          </div>
        </>
      )}

      <section className={s.card} aria-labelledby="correlations">
        <div className={s.cardHead}>
          <div>
            <h3 id="correlations">Attainment and behaviour</h3>
            <p>
              How students&apos; latest results line up with their behaviour over the last {windowDays} days. Uses the latest result from every active cycle,
              {" "}{correlation.pairedStudentCount} students in all.
            </p>
          </div>
          <nav className={s.segmented} aria-label="Behaviour period">
            {VALID_WINDOWS.map((w) => (
              <Link key={w} href={evidenceHref("analysis", { cycle: cycleParam, windowDays: w === 21 ? undefined : String(w) })} aria-current={windowDays === w ? "true" : undefined}>
                {w} days
              </Link>
            ))}
          </nav>
        </div>
        {strong.length ? (
          <div className={correlationStyles.correlations}>
            {strong.map((row) => (
              <div key={row.metric} className={correlationStyles.correlation}>
                <span>{row.metricLabel}</span>
                <strong>{row.correlation >= 0 ? "+" : "−"}{Math.abs(row.correlation).toFixed(2)}</strong>
                <div className={correlationStyles.track} aria-hidden>
                  <div style={{ width: `${Math.min(100, Math.abs(row.correlation) * 100)}%` }} />
                </div>
                <p>{strengthLabel(row.strength)} · {row.sampleSize} students</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={s.empty}>No clear relationship (r of 0.3 or more, with enough students) in this period.</p>
        )}
        <p className={`${s.note} ${correlationStyles.caption}`}>
          A correlation shows two things move together, from −1 to +1. It doesn&apos;t show that one causes the other.
        </p>
      </section>
    </AttainmentEvidenceShell>
  );
}
