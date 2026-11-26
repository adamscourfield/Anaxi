import type { CSSProperties } from "react";
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
import { canViewExplorer, canViewAssessmentExplorer, canExportExplorer } from "@/modules/authz";
import { computeAssessmentAnalysis, type AssessmentCohortRow } from "@/modules/analysis/assessmentAnalysis";
import { resolveAttainmentCycle } from "@/modules/analysis/attainmentCycle";
import {
  average,
  changeTone,
  formatIndex,
  formatIndexChange,
  gapTone,
  type AttainmentTone,
} from "@/modules/analysis/attainmentFormat";
import { compareYearGroups, formatYearGroup } from "@/lib/yearGroup";

const MEASURES = {
  mean: { label: "Mean", help: "Mean score on the 0–100 index. Darker cells scored higher." },
  movement: { label: "Change", help: "Change in mean since the previous result point, in index points." },
  sendGap: { label: "SEND gap", help: "Non-SEND mean minus SEND mean, in index points. Positive means SEND students scored lower." },
  ppGap: { label: "PP gap", help: "Non-pupil-premium mean minus pupil premium mean, in index points. Positive means pupil premium students scored lower." },
} as const;
type Measure = keyof typeof MEASURES;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** One ink hue, stronger for higher means; 40 and below is unshaded, 85 and above is darkest. */
function heatStyle(mean: number | null): CSSProperties | undefined {
  if (mean === null) return undefined;
  const t = Math.min(1, Math.max(0, (mean - 0.4) / 0.45));
  return { background: `rgba(28, 28, 30, ${(0.03 + t * 0.13).toFixed(3)})` };
}

export default async function AssessmentCohortsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");
  const viewer = await buildViewerContext(user);
  if (!canViewExplorer(viewer) || !canViewAssessmentExplorer(viewer)) notFound();

  const measure: Measure = one(params.view) in MEASURES ? (one(params.view) as Measure) : "mean";
  const yearGroup = one(params.yearGroup);

  const { cycles, selected } = await resolveAttainmentCycle(user.tenantId, one(params.cycle));
  const analysis = selected ? await computeAssessmentAnalysis(user.tenantId, { cycleId: selected.id }) : null;
  const all = analysis?.cohorts ?? [];
  const yearGroups = Array.from(new Set(all.map((r) => r.yearGroup))).sort(compareYearGroups);
  const rows = yearGroup ? all.filter((r) => r.yearGroup === yearGroup) : all;
  const subjects = Array.from(new Set(rows.map((r) => r.subject))).sort();
  const shownYears = yearGroup ? yearGroups.filter((y) => y === yearGroup) : yearGroups;
  const lookup = new Map(rows.map((r) => [`${r.yearGroup}|${r.subject}`, r]));

  const filters = { cycle: selected?.id, view: measure === "mean" ? undefined : measure, yearGroup: yearGroup || undefined };
  const tone = (t: AttainmentTone) => (t === "concern" ? s.concern : t === "positive" ? s.positive : "");

  function cell(row: AssessmentCohortRow | undefined) {
    if (!row) return { text: "—", className: s.muted, style: undefined };
    switch (measure) {
      case "movement": return { text: formatIndexChange(row.movement), className: tone(changeTone(row.movement)), style: undefined };
      case "sendGap": return { text: formatIndexChange(row.sendGap), className: tone(gapTone(row.sendGap)), style: undefined };
      case "ppGap": return { text: formatIndexChange(row.ppGap), className: tone(gapTone(row.ppGap)), style: undefined };
      default: return { text: formatIndex(row.meanNormalizedScore), className: "", style: heatStyle(row.meanNormalizedScore) };
    }
  }

  const declining = rows.filter((r) => changeTone(r.movement) === "concern").length;
  const bandRows = rows
    .filter((r) => r.lowPriorMean !== null || r.midPriorMean !== null || r.highPriorMean !== null)
    .sort((a, b) => compareYearGroups(a.yearGroup, b.yearGroup) || a.subject.localeCompare(b.subject));

  return (
    <AttainmentEvidenceShell
      page="groups"
      title="Group breakdown"
      subtitle="Year group and subject side by side, with results by prior attainment and the SEND and pupil premium gaps."
      cycles={cycles}
      selected={selected}
      cycleHref={(id) => evidenceHref("groups", { ...filters, cycle: id, yearGroup: undefined })}
      exportView={canExportExplorer(viewer) ? "ASSESSMENT_COHORTS" : undefined}
    >
      {!selected || !all.length ? (
        <EvidenceEmpty
          title="No group results to show"
          body={selected ? "This cycle has no validated, published or locked results linked to year groups yet." : "Set up an assessment cycle to see group results."}
        />
      ) : (
        <>
          <div className={s.summary}>
            <div className={s.tile}><span>Mean across groups</span><strong>{formatIndex(average(rows.map((r) => r.meanNormalizedScore)))}</strong><p>0–100 index</p></div>
            <div className={s.tile}><span>Groups down 5+ points</span><strong>{declining}</strong><p>of {rows.length} year and subject groups</p></div>
            <div className={s.tile}><span>Average SEND gap</span><strong>{formatIndexChange(average(rows.map((r) => r.sendGap)))}</strong><p>Index points</p></div>
            <div className={s.tile}><span>Average PP gap</span><strong>{formatIndexChange(average(rows.map((r) => r.ppGap)))}</strong><p>Index points</p></div>
          </div>

          <div className={s.bar}>
            <nav className={s.segmented} aria-label="Measure shown in the grid">
              {(Object.keys(MEASURES) as Measure[]).map((m) => (
                <Link key={m} href={evidenceHref("groups", { ...filters, view: m === "mean" ? undefined : m })} aria-current={measure === m ? "true" : undefined}>
                  {MEASURES[m].label}
                </Link>
              ))}
            </nav>
            {yearGroups.length > 1 && (
              <nav className={s.segmented} aria-label="Year group">
                <Link href={evidenceHref("groups", { ...filters, yearGroup: undefined })} aria-current={!yearGroup ? "true" : undefined}>All years</Link>
                {yearGroups.map((yg) => (
                  <Link key={yg} href={evidenceHref("groups", { ...filters, yearGroup: yg })} aria-current={yearGroup === yg ? "true" : undefined}>
                    {formatYearGroup(yg)}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className={s.card}>
            <div className={s.cardHead}>
              <div>
                <h3>{MEASURES[measure].label} by year group and subject</h3>
                <p>{MEASURES[measure].help}</p>
              </div>
            </div>
            <div className={s.scroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Year group</th>
                    {subjects.map((sub) => <th key={sub} className={s.heat}>{sub}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {shownYears.map((yg) => (
                    <tr key={yg}>
                      <td className={`${s.nowrap} ${s.strong}`}>{formatYearGroup(yg)}</td>
                      {subjects.map((sub) => {
                        const c = cell(lookup.get(`${yg}|${sub}`));
                        return <td key={sub} className={`${s.heat} ${c.className}`} style={c.style}>{c.text}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {bandRows.length > 0 && (
            <div className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <h3>Results by prior attainment</h3>
                  <p>Mean for students with low, middle and high prior attainment, alongside each group&apos;s gaps.</p>
                </div>
              </div>
              <div className={s.scroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Subject</th>
                      <th className={s.num}>Students</th>
                      <th className={s.num}>Low prior</th>
                      <th className={s.num}>Middle prior</th>
                      <th className={s.num}>High prior</th>
                      <th className={s.num}>Change</th>
                      <th className={s.num}>SEND gap</th>
                      <th className={s.num}>PP gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandRows.map((r) => (
                      <tr key={`${r.yearGroup}|${r.subject}`}>
                        <td className={`${s.nowrap} ${s.muted}`}>{formatYearGroup(r.yearGroup)}</td>
                        <td className={`${s.nowrap} ${s.strong}`}>{r.subject}</td>
                        <td className={`${s.num} ${s.muted}`}>{r.studentCount}</td>
                        <td className={s.num}>{formatIndex(r.lowPriorMean)}</td>
                        <td className={s.num}>{formatIndex(r.midPriorMean)}</td>
                        <td className={s.num}>{formatIndex(r.highPriorMean)}</td>
                        <td className={`${s.num} ${tone(changeTone(r.movement))}`}>{formatIndexChange(r.movement)}</td>
                        <td className={`${s.num} ${tone(gapTone(r.sendGap))}`}>{formatIndexChange(r.sendGap)}</td>
                        <td className={`${s.num} ${tone(gapTone(r.ppGap))}`}>{formatIndexChange(r.ppGap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className={s.note}>
            Scores are normalised to a 0–100 index so different grade scales can be compared; they are not percentages. Prior attainment bands come from KS2
            scaled scores (below 95, 95–105, above 105). Gaps and band means need at least three students and are left blank otherwise. Red marks a drop of
            5 points or more, or a gap above 8 points.
          </p>
        </>
      )}
    </AttainmentEvidenceShell>
  );
}
