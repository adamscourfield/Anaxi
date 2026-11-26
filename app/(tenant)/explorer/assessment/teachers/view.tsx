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
import { computeAssessmentAnalysis, type AssessmentTeacherRow } from "@/modules/analysis/assessmentAnalysis";
import { resolveAttainmentCycle } from "@/modules/analysis/attainmentCycle";
import { filterVisibleTeachers, visibleAttainmentTeacherIds } from "@/modules/analysis/attainmentScope";
import {
  average,
  changeTone,
  formatIndex,
  formatIndexChange,
  formatIndexPoints,
  gapTone,
  type AttainmentTone,
} from "@/modules/analysis/attainmentFormat";
import { formatYearGroup } from "@/lib/yearGroup";

const PER_PAGE = 25;
const SORTS = { valueAdd: "Value-added, lowest first", mean: "Mean, highest first", name: "Name A–Z" } as const;
type Sort = keyof typeof SORTS;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function teacherGaps(row: AssessmentTeacherRow) {
  return {
    send: average(row.subjects.map((x) => x.sendGap)),
    pp: average(row.subjects.map((x) => x.ppGap)),
    students: row.subjects.reduce((sum, x) => sum + x.studentCount, 0),
  };
}

export default async function AssessmentTeachersPage({
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
  const sort: Sort = one(params.sort) in SORTS ? (one(params.sort) as Sort) : "valueAdd";

  const { cycles, selected } = await resolveAttainmentCycle(user.tenantId, one(params.cycle));
  const [analysis, visible] = await Promise.all([
    selected ? computeAssessmentAnalysis(user.tenantId, { cycleId: selected.id }) : null,
    visibleAttainmentTeacherIds(user.tenantId, viewer),
  ]);
  const teachers = filterVisibleTeachers(analysis?.teachers ?? [], visible);

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = teachers
    .filter((r) => words.every((w) => r.teacherName.toLowerCase().includes(w)))
    .sort((a, b) => {
      if (sort === "name") return a.teacherName.localeCompare(b.teacherName);
      if (sort === "mean") return (b.overallMean ?? -1) - (a.overallMean ?? -1);
      // Teachers without a value-added figure go to the end rather than sitting among zeros.
      return (a.overallValueAdd ?? Infinity) - (b.overallValueAdd ?? Infinity);
    });

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pageCount, Math.max(1, Number.parseInt(one(params.page), 10) || 1));
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const filters = { cycle: selected?.id, q: search || undefined, sort: sort === "valueAdd" ? undefined : sort };
  const pageHref = (p: number) => evidenceHref("teachers", { ...filters, page: p > 1 ? String(p) : undefined });

  const below = teachers.filter((t) => changeTone(t.overallValueAdd) === "concern");
  const above = teachers.filter((t) => changeTone(t.overallValueAdd) === "positive");
  const tone = (t: AttainmentTone) => (t === "concern" ? s.concern : t === "positive" ? s.positive : "");

  return (
    <AttainmentEvidenceShell
      page="teachers"
      title="Teacher attribution"
      subtitle="How each teacher's students scored against what their prior attainment would predict, with SEND and pupil premium gaps."
      cycles={cycles}
      selected={selected}
      cycleHref={(id) => evidenceHref("teachers", { ...filters, cycle: id })}
      exportView={canExportExplorer(viewer) ? "ASSESSMENT_TEACHERS" : undefined}
    >
      {!selected || !teachers.length ? (
        <EvidenceEmpty
          title="No teacher results to show"
          body={
            !selected
              ? "Set up an assessment cycle to see teacher attribution."
              : analysis?.teachers.length
                ? "None of the teachers with results in this cycle are in the departments you lead."
                : "Results need to be linked to classes and teachers before they can be attributed."
          }
        />
      ) : (
        <>
          <div className={s.summary}>
            <div className={s.tile}><span>Teachers with results</span><strong>{teachers.length}</strong></div>
            <div className={s.tile}><span>Below expected</span><strong>{below.length}</strong><p>Value-added of −5 points or lower</p></div>
            <div className={s.tile}><span>Above expected</span><strong>{above.length}</strong><p>Value-added of +5 points or higher</p></div>
            <div className={s.tile}><span>Average value-added</span><strong>{formatIndexChange(average(teachers.map((t) => t.overallValueAdd)))}</strong><p>Index points</p></div>
          </div>

          <section className={s.controls} aria-label="Find and sort teachers">
            <form method="GET">
              <input type="hidden" name="cycle" value={selected.id} />
              <label className={s.field}>
                Teacher name
                <input type="search" name="q" defaultValue={search} placeholder="Find a teacher…" />
              </label>
              <label className={s.field}>
                Sort by
                <select name="sort" defaultValue={sort}>
                  {Object.entries(SORTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <button type="submit">Apply</button>
              {(search || sort !== "valueAdd") && <Link className={s.clear} href={evidenceHref("teachers", { cycle: selected.id })}>Clear</Link>}
            </form>
          </section>

          <div className={s.heading}>
            <h2>Teachers</h2>
            <span>{rows.length} {rows.length === 1 ? "teacher" : "teachers"} · {SORTS[sort].toLowerCase()}</span>
          </div>

          {!rows.length ? (
            <EvidenceEmpty title="No teachers match that name" body="Check the spelling or clear the search." />
          ) : (
            <div className={s.card}>
              <div className={s.scroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Subjects</th>
                      <th className={s.num} title="Mean normalised score on a 0–100 index">Mean</th>
                      <th className={s.num} title="Mean minus the mean expected from students' prior attainment, in index points">Value-added</th>
                      <th className={s.num} title="Non-SEND mean minus SEND mean, in index points">SEND gap</th>
                      <th className={s.num} title="Non-pupil-premium mean minus pupil premium mean, in index points">PP gap</th>
                      <th className={s.num}>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const g = teacherGaps(row);
                      return (
                        <tr key={row.teacherId}>
                          <td>
                            <div className={s.person}>
                              <Avatar name={row.teacherName} userId={row.teacherId} size="sm" />
                              <span>
                                <span>{row.teacherName}</span>
                                {row.departmentNames.length > 0 && <span className={s.sub}>{row.departmentNames.join(", ")}</span>}
                              </span>
                            </div>
                          </td>
                          <td className={s.subjects}>{Array.from(new Set(row.subjects.map((x) => x.subject))).join(", ") || "—"}</td>
                          <td className={`${s.num} ${s.strong}`}>{formatIndex(row.overallMean)}</td>
                          <td className={`${s.num} ${tone(changeTone(row.overallValueAdd))}`}>{formatIndexChange(row.overallValueAdd)}</td>
                          <td className={`${s.num} ${tone(gapTone(g.send))}`}>{formatIndexChange(g.send)}</td>
                          <td className={`${s.num} ${tone(gapTone(g.pp))}`}>{formatIndexChange(g.pp)}</td>
                          <td className={`${s.num} ${s.muted}`}>{g.students}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <EvidencePagination page={page} pageCount={pageCount} total={rows.length} perPage={PER_PAGE} itemLabel="teachers" href={pageHref} />
            </div>
          )}

          {below.length > 0 && (
            <div className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <h3>Where the shortfall is</h3>
                  <p>Each subject and year taught by the {below.length === 1 ? "teacher" : `${below.length} teachers`} below expected.</p>
                </div>
              </div>
              <div className={s.scroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Subject</th>
                      <th>Year</th>
                      <th className={s.num}>Mean</th>
                      <th className={s.num}>Value-added</th>
                      <th className={s.num}>SEND gap</th>
                      <th className={s.num}>PP gap</th>
                      <th className={s.num} title="Students declining, stable and improving since the previous result point">Down / same / up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {below.flatMap((t) =>
                      t.subjects.map((sub, i) => (
                        <tr key={`${t.teacherId}-${sub.subject}-${sub.yearGroup}`}>
                          <td className={s.nowrap}>{i === 0 ? <span className={s.strong}>{t.teacherName}</span> : null}</td>
                          <td className={s.nowrap}>{sub.subject}</td>
                          <td className={`${s.nowrap} ${s.muted}`}>{formatYearGroup(sub.yearGroup)}</td>
                          <td className={s.num}>{formatIndex(sub.meanNormalizedScore)}</td>
                          <td className={`${s.num} ${tone(changeTone(sub.valueAdd))}`}>{formatIndexChange(sub.valueAdd)}</td>
                          <td className={`${s.num} ${tone(gapTone(sub.sendGap))}`}>{formatIndexChange(sub.sendGap)}</td>
                          <td className={`${s.num} ${tone(gapTone(sub.ppGap))}`}>{formatIndexChange(sub.ppGap)}</td>
                          <td className={`${s.num} ${s.muted}`}>{sub.decliningCount} / {sub.stableCount} / {sub.improvingCount}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className={s.note}>
            Value-added is the teacher&apos;s mean minus the mean expected from their students&apos; prior attainment bands, in points on the 0–100 index
            (school average here: {formatIndexPoints(average(teachers.map((t) => t.overallValueAdd)))}). Gaps are the other students&apos; mean minus the group&apos;s mean,
            so a positive gap means SEND or pupil premium students scored lower. Groups under three students are not reported. These figures point to where to
            look; they don&apos;t establish that teaching caused the difference.
          </p>
        </>
      )}
    </AttainmentEvidenceShell>
  );
}
