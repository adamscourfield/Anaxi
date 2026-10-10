"use client";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { TableScrollRegion } from "@/components/ui/table-scroll-region";
import { BarChart, AttendanceRing } from "./charts";
import { attendanceBand } from "@/modules/classes/metrics";
import type { ClassData } from "@/modules/classes/data";

const categories = [ ["DETENTION", "Detentions"], ["INTERNAL_EXCLUSION", "Internal exclusions"], ["SUSPENSION", "Suspensions"], ["LATENESS", "Late events"], ["POSITIVE_POINTS", "Positive awards"] ] as const;
const scopeLabels: Record<string, string> = { TERM_TO_DATE: "Term to date", YEAR_TO_DATE: "Year to date", ROLLING_21_DAYS: "Rolling 21 days", ROLLING_28_DAYS: "Rolling 28 days" };
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
function Grade({ grade }: { grade: ClassData["students"][number]["grades"][number] | undefined }) {
  if (!grade?.value?.trim() || grade.status !== "PRESENT") return <span className="text-xs text-muted">{!grade || grade.status === "NOT_ENTERED" ? "Not recorded" : grade.status.replaceAll("_", " ").toLowerCase()}</span>;
  if (!grade.valid) return <span className="text-xs text-muted" title={`Unvalidated value: ${grade.value}`}>Invalid result</span>;
  return <span className="font-semibold tabular-nums">{grade.value}</span>;
}

export function ClassDetail({ data, windowDays }: { data: ClassData; windowDays: number }) {
  const cycles = [...new Map(data.points.map(point => [point.cycleId, point.cycle]))];
  const [cycleId, setCycleId] = useState(cycles[0]?.[0] ?? "");
  const cyclePoints = data.points.filter(point => point.cycleId === cycleId);
  const [pointId, setPointId] = useState(cyclePoints[0]?.id ?? "");
  const point = cyclePoints.find(p => p.id === pointId) ?? cyclePoints[0];
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const visible = useMemo(() => data.students.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "attendance" ? (a.snapshot?.attendancePct ?? 101) - (b.snapshot?.attendancePct ?? 101) : sort === "detentions" ? (b.events.DETENTION ?? 0) - (a.events.DETENTION ?? 0) : a.name.localeCompare(b.name)), [data.students, search, sort]);
  const validGrades = point ? data.students.flatMap(s => { const grade = s.grades.find(g => g.pointId === point.id); return grade?.valid && grade.status === "PRESENT" && grade.value?.trim() ? [grade] : []; }) : [];
  const distribution = new Map<string, number>();
  for (const grade of validGrades) {
    let label = grade.value!.trim();
    if ((point?.format === "PERCENTAGE" || point?.format === "RAW") && grade.normalizedScore !== null) {
      const index = Math.min(4, Math.max(0, Math.floor(grade.normalizedScore * 5)));
      label = ["0–19%", "20–39%", "40–59%", "60–79%", "80–100%"][index];
    }
    distribution.set(label, (distribution.get(label) ?? 0) + 1);
  }
  const gradeOrder = ["U", "E", "D", "C", "B", "A", "A*"];
  const gradeRows = [...distribution].map(([label, value]) => ({ label, value })).sort((a, b) => point?.format === "A_LEVEL" ? gradeOrder.indexOf(a.label) - gradeOrder.indexOf(b.label) : a.label.localeCompare(b.label, undefined, { numeric: true }));
  const bands = [ { label: "95–100%", color: "var(--success)" }, { label: "90–94.9%", color: "var(--warning)" }, { label: "Below 90%", color: "var(--error)" } ].map(band => ({ ...band, value: data.students.filter(s => s.snapshot && attendanceBand(s.snapshot.attendancePct) === band.label).length }));
  const historyPoints = [...cyclePoints].reverse();
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Class size" value={data.count} context={`${data.yearGroup} · Current roster`} tone="glass" />
      <StatCard label="Overall attendance" value={data.attendance.value === null ? "—" : `${data.attendance.value.toFixed(1)}%`} context={`${data.attendance.count}/${data.count} pupils · ${data.attendance.weighted ? "Session weighted" : "Mean of pupil rates"}`} tone="glass" />
      <StatCard label="Detentions" value={data.events.DETENTION ?? 0} context={`Recorded pupil events · last ${windowDays} days`} tone="glass" />
      <StatCard label="Attainment recorded" value={`${validGrades.length} / ${data.count}`} context={point?.label ?? "No subject assessment results"} tone="softGrey" />
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <AttendanceRing bands={bands} missing={data.count - data.attendance.count} />
      <BarChart title="Behaviour events" subtitle={`Current pupils · last ${windowDays} days · all lessons`} rows={categories.map(([key, label]) => ({ label, value: data.events[key] ?? 0 }))} color="var(--warning)" />
      <BarChart title="Attainment distribution" subtitle={point ? `${point.cycle} · ${point.label}${point.format === "RAW" ? " · % of available marks" : ""}` : "No subject results have been recorded"} rows={gradeRows} color="var(--primary)" />
    </div>
    <section className="class-panel p-5 sm:p-6" aria-labelledby="class-attainment-heading">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><h2 id="class-attainment-heading" className="text-lg font-semibold">Subject attainment</h2><p className="mt-1 text-sm text-muted">{data.subject} · Assessment history for the current class roster.</p></div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <div className="class-field min-w-[180px] flex-1"><label htmlFor="class-cycle">Assessment cycle</label><select className="field" id="class-cycle" value={cycleId} disabled={!cycles.length} onChange={e => { setCycleId(e.target.value); setPointId(data.points.find(p => p.cycleId === e.target.value)?.id ?? ""); }}>{!cycles.length && <option>No recorded cycles</option>}{cycles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="class-field min-w-[180px] flex-1"><label htmlFor="class-point">Chart assessment</label><select className="field" id="class-point" value={point?.id ?? ""} disabled={!cyclePoints.length} onChange={e => setPointId(e.target.value)}>{!cyclePoints.length && <option>No recorded assessments</option>}{cyclePoints.map(p => <option key={p.id} value={p.id}>{p.label} · {p.format.replaceAll("_", " ")}{p.maxScore ? ` / ${p.maxScore}` : ""}</option>)}</select></div>
        </div>
      </div>
      {point && <p className="mt-4 text-xs text-muted">Chart: {point.label} · {date(point.date)} · {point.status.toLowerCase()} · {validGrades.length} valid results. {data.count - validGrades.length} pupils without a valid present result.</p>}
      {!historyPoints.length ? <p className="py-10 text-center text-sm text-muted">No assessment results linked to this subject yet.</p> : <div className="mt-5"><TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><caption className="sr-only">{data.subject} results for every pupil in {data.name}</caption><thead><tr><th scope="col">Pupil</th>{historyPoints.map(p => <th scope="col" key={p.id}><span>{p.label}</span><span className="mt-1 block text-[10px] font-normal normal-case tracking-normal">{date(p.date)} · {p.format.replaceAll("_", " ")}{p.maxScore ? ` / ${p.maxScore}` : ""} · {p.status.toLowerCase()}</span></th>)}</tr></thead><tbody>{data.students.map(student => <tr key={student.id}><th scope="row" className="whitespace-nowrap font-medium">{student.name}</th>{historyPoints.map(p => <td key={p.id}><Grade grade={student.grades.find(g => g.pointId === p.id)} /></td>)}</tr>)}</tbody></table></TableScrollRegion></div>}
    </section>
    <section className="class-panel overflow-hidden" aria-labelledby="class-roster-heading">
      <div className="border-b border-border p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 id="class-roster-heading" className="text-lg font-semibold">Pupil overview</h2><p className="mt-1 text-sm text-muted">Overall attendance and recorded behaviour events in the last {windowDays} days.</p></div><span className="class-badge" role="status">{visible.length} pupils</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]"><div className="class-field"><label htmlFor="pupil-search">Find a pupil</label><input className="field" id="pupil-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" /></div><div className="class-field"><label htmlFor="pupil-sort">Sort by</label><select className="field" id="pupil-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Pupil name</option><option value="attendance">Lowest attendance</option><option value="detentions">Most detentions</option></select></div></div>
      </div>
      <div className="px-5 sm:px-6"><TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><caption className="sr-only">Pupil attendance and behaviour events, last {windowDays} days</caption><thead><tr><th scope="col">Pupil</th><th scope="col">Attendance</th><th scope="col">Register sessions</th>{categories.map(([key, label]) => <th key={key} scope="col">{label}</th>)}<th scope="col">Positive points</th></tr></thead><tbody>{visible.map(student => <tr key={student.id}><th scope="row" className="whitespace-nowrap font-medium">{student.name}</th><td><span className={`font-semibold tabular-nums ${student.snapshot && student.snapshot.attendancePct < 90 ? "text-error" : ""}`}>{student.snapshot ? `${student.snapshot.attendancePct.toFixed(1)}%` : "Not recorded"}</span>{student.snapshot && <span className="mt-1 block whitespace-nowrap text-[11px] text-muted">{date(student.snapshot.snapshotDate)}</span>}</td><td className="tabular-nums text-xs">{student.snapshot?.attendancePossibleCount ? `${student.snapshot.attendancePresentCount} / ${student.snapshot.attendancePossibleCount}` : "Not available"}</td>{categories.map(([key]) => <td className="tabular-nums" key={key}>{student.events[key] ?? 0}</td>)}<td className="tabular-nums">{student.events.positivePoints ?? 0}</td></tr>)}</tbody></table></TableScrollRegion>{!visible.length && <p className="py-10 text-center text-sm text-muted">No pupils match this search.</p>}</div>
      <p className="border-t border-border px-6 py-4 text-xs leading-relaxed text-muted">Attendance uses each pupil’s latest snapshot; dates may differ. Behaviour counts show stored individual events, which may be incomplete if only cumulative totals have been imported. These figures describe the pupils in this class, rather than events attributed to this lesson.</p>
    </section>
    <details className="class-panel group p-5 sm:p-6"><summary className="cursor-pointer text-sm font-semibold focus-visible:outline-accent">Latest cumulative behaviour totals <span className="ml-2 text-xs font-normal text-muted">Expand pupil snapshots</span></summary><p className="mt-3 text-xs text-muted">Totals retain their original reporting period. They are separate from the {windowDays}-day event counts above.</p><div className="mt-5"><TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><caption className="sr-only">Latest cumulative behaviour snapshots</caption><thead><tr>{["Pupil", "Snapshot / period", "Positive points", "Negative points", "Detentions", "On calls", "Lateness", "Internal exclusions", "Suspensions"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.students.map(student => <tr key={student.id}><th scope="row" className="whitespace-nowrap font-medium">{student.name}</th><td className="text-xs text-muted">{student.snapshot ? <>{date(student.snapshot.snapshotDate)}<span className="mt-1 block whitespace-nowrap">{scopeLabels[student.snapshot.countScope] ?? student.snapshot.countScope}</span></> : "Not recorded"}</td>{(["positivePointsTotal", "negativePointsTotal", "detentionsCount", "onCallsCount", "latenessCount", "internalExclusionsCount", "suspensionsCount"] as const).map(key => <td key={key} className="tabular-nums">{student.snapshot?.[key] ?? "—"}</td>)}</tr>)}</tbody></table></TableScrollRegion></div></details>
  </>;
}
