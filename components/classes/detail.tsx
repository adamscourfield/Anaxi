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
  const [behaviourSource, setBehaviourSource] = useState(data.behaviourSnapshots[0]?.scope ?? "events");
  const behaviourSnapshot = data.behaviourSnapshots.find(s => s.scope === behaviourSource);
  const behaviourRows = behaviourSnapshot ? [
    { label: "Detentions", value: behaviourSnapshot.detentions },
    { label: "On calls", value: behaviourSnapshot.onCalls },
    { label: "Late arrivals", value: behaviourSnapshot.lateness },
    { label: "Internal exclusions", value: behaviourSnapshot.internalExclusions },
    { label: "Suspensions", value: behaviourSnapshot.suspensions },
  ] : categories.map(([key, label]) => ({ label, value: data.events[key] ?? 0 }));
  type Pupil = ClassData["students"][number];
  const [selection, setSelection] = useState<{ label: string; ids: string[] } | null>(null);
  function selectPupils(label: string, predicate: (student: Pupil) => boolean) {
    setSelection({ label, ids: data.students.filter(predicate).map(s => s.id) });
    document.getElementById("class-roster-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const behaviourFields = { "Detentions": "detentionsCount", "On calls": "onCallsCount", "Late arrivals": "latenessCount", "Internal exclusions": "internalExclusionsCount", "Suspensions": "suspensionsCount", "Award points": "positivePointsTotal" } as const;
  function behaviourValue(student: Pupil, label: string) {
    if (behaviourSnapshot) { const key = behaviourFields[label as keyof typeof behaviourFields]; return student.snapshot?.countScope === behaviourSource && key ? student.snapshot[key] : 0; }
    const category = categories.find(([, name]) => name === label)?.[0];
    return category ? student.events[category] ?? 0 : 0;
  }
  const [search, setSearch] = useState("");
  const visible = useMemo(() => data.students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) && (!selection || selection.ids.includes(s.id))).sort((a, b) => a.name.localeCompare(b.name)), [data.students, search, selection]);
  const validGrades = point ? data.students.flatMap(s => { const grade = s.grades.find(g => g.pointId === point.id); return grade?.valid && grade.status === "PRESENT" && grade.value?.trim() ? [grade] : []; }) : [];
  const gradeBands = point?.format === "INDEX" ? ["0–19", "20–39", "40–59", "60–79", "80–100"] : ["0–19%", "20–39%", "40–59%", "60–79%", "80–100%"];
  const distribution = new Map<string, number>();
  for (const grade of validGrades) {
    let label = grade.value!.trim();
    if ((point?.format === "PERCENTAGE" || point?.format === "RAW" || point?.format === "INDEX") && grade.normalizedScore !== null) {
      const index = Math.min(4, Math.max(0, Math.floor(grade.normalizedScore * 5)));
      label = gradeBands[index];
    }
    distribution.set(label, (distribution.get(label) ?? 0) + 1);
  }
  const gradeOrder = ["U", "E", "D", "C", "B", "A", "A*"];
  const gradeRows = [...distribution].map(([label, value]) => ({ label, value })).sort((a, b) => point?.format === "A_LEVEL" ? gradeOrder.indexOf(a.label) - gradeOrder.indexOf(b.label) : a.label.localeCompare(b.label, undefined, { numeric: true }));
  const bands = [ { label: "95–100%", color: "var(--success)" }, { label: "90–94.9%", color: "var(--warning)" }, { label: "Below 90%", color: "var(--error)" } ].map(band => ({ ...band, value: data.students.filter(s => s.snapshot && attendanceBand(s.snapshot.attendancePct) === band.label).length }));
  function gradeLabel(student: Pupil) {
    const grade = student.grades.find(g => g.pointId === point?.id);
    if (!grade?.valid || grade.status !== "PRESENT") return "No valid result";
    if ((point?.format === "PERCENTAGE" || point?.format === "RAW" || point?.format === "INDEX") && grade.normalizedScore !== null) return gradeBands[Math.min(4, Math.max(0, Math.floor(grade.normalizedScore * 5)))];
    return grade.value?.trim() ?? "No valid result";
  }
  const scores = validGrades.flatMap(g => g.normalizedScore === null ? [] : [g.normalizedScore]);
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const attainment = average === null ? "—" : point?.format === "GCSE" ? `${(average * 9).toFixed(1)}` : point?.format === "A_LEVEL" ? `${(average * 7).toFixed(1)} / 7` : point?.format === "RAW" ? `${(average * (point.maxScore ?? 1)).toFixed(1)} / ${point.maxScore ?? "?"}` : point?.format === "INDEX" ? `${(average * 100).toFixed(1)} / 100` : `${(average * 100).toFixed(1)}%`;
  const ks2 = data.students.flatMap(s => s.ks2Reading !== null && s.ks2Maths !== null ? [(s.ks2Reading + s.ks2Maths) / 2] : []);
  const ks2Bands = ["Below 100", "100–109", "110 and above", "Not recorded"];
  function ks2Band(s: Pupil) { if (s.ks2Reading === null || s.ks2Maths === null) return "Not recorded"; const n = (s.ks2Reading + s.ks2Maths) / 2; return n < 100 ? ks2Bands[0] : n < 110 ? ks2Bands[1] : ks2Bands[2]; }
  if (behaviourSnapshot) behaviourRows.push({ label: "Award points", value: data.students.reduce((sum, student) => sum + (student.snapshot?.countScope === behaviourSource ? student.snapshot.positivePointsTotal : 0), 0) });
  const historyPoints = [...cyclePoints].reverse();
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Class size" value={data.count} context={`${data.yearGroup} · Current roster`} tone="glass" />
      <StatCard label="Overall attendance" value={data.attendance.value === null ? "—" : `${data.attendance.value.toFixed(1)}%`} context={`${data.attendance.count}/${data.count} pupils · ${data.attendance.weighted ? "Session weighted" : "Mean of pupil rates"}`} tone="glass" />
      <StatCard label="Average KS2 scaled score" value={ks2.length ? (ks2.reduce((a, b) => a + b, 0) / ks2.length).toFixed(1) : "—"} context={`Reading and maths mean · ${ks2.length}/${data.count} pupils with both scores`} tone="glass" />
      <StatCard label="Average attainment" value={attainment} context={`${scores.length}/${data.count} valid results · ${point?.format === "A_LEVEL" ? "A*=7, A=6 … E=2, U=0 · " : ""}${point?.label ?? "No assessment data"}`} tone="softGrey" />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <AttendanceRing bands={bands} missing={data.count - data.attendance.count} onSelect={label => selectPupils(`Attendance: ${label}`, s => label === "No attendance data" ? !s.snapshot : !!s.snapshot && attendanceBand(s.snapshot.attendancePct) === label)} />
      <BarChart title={behaviourSnapshot ? "Behaviour totals" : "Behaviour events"} subtitle={behaviourSnapshot ? `${behaviourSnapshot.label} · ${behaviourSnapshot.pupils}/${data.count} pupils · Latest snapshots` : `Recorded pupil events · last ${windowDays} days · all lessons`} rows={behaviourRows} color="var(--warning)" onSelect={label => selectPupils(label, s => behaviourValue(s, label) > 0)} controls={<div className="class-field"><label htmlFor="behaviour-source">Reporting period</label><select className="field" id="behaviour-source" value={behaviourSource} onChange={e => { setBehaviourSource(e.target.value); setSelection(null); }}><option value="events">Events · last {windowDays} days</option>{data.behaviourSnapshots.map(s => <option key={s.scope} value={s.scope}>{s.label} · {s.pupils} pupils</option>)}</select></div>} />
      <BarChart title="Attainment distribution" subtitle={point ? `${point.cycle} · ${point.label}${point.format === "RAW" ? " · % of available marks" : ""}` : "No subject results have been recorded"} rows={[...gradeRows, { label: "No valid result", value: data.count - validGrades.length }]} color="var(--primary)" onSelect={label => selectPupils(`Attainment: ${label}`, s => gradeLabel(s) === label)} />
    <BarChart title="KS2 prior attainment" subtitle="Mean of reading and maths scaled scores · select a band to see its pupils" rows={ks2Bands.map(label => ({ label, value: data.students.filter(s => ks2Band(s) === label).length }))} onSelect={label => selectPupils(`KS2: ${label}`, s => ks2Band(s) === label)} />
    </div>
    <section className="class-panel overflow-hidden" aria-labelledby="class-roster-heading">
      <div className="border-b border-border p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="class-roster-heading" className="text-lg font-semibold">Class pupils</h2><p className="mt-1 text-sm text-muted">{visible.length} of {data.count} pupils · {selection?.label ?? "Full class roster"}</p></div>{selection && <button type="button" className="class-page-button" onClick={() => { setSelection(null); setSearch(""); }}>Show all pupils</button>}</div><div className="class-field mt-4"><label htmlFor="pupil-search">Find a pupil</label><input className="field" id="pupil-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" /></div></div>
      <div className="px-5 sm:px-6"><TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><caption className="sr-only">Class roster with attendance, prior attainment, current attainment and behaviour</caption><thead><tr><th>Pupil</th><th>Attendance</th><th>KS2 reading</th><th>KS2 maths</th><th>Latest attainment</th>{behaviourRows.map(r => <th key={r.label}>{r.label}</th>)}</tr></thead><tbody>{visible.map(student => <tr key={student.id}><th scope="row" className="whitespace-nowrap font-medium">{student.name}</th><td>{student.snapshot ? `${student.snapshot.attendancePct.toFixed(1)}%` : "—"}</td><td>{student.ks2Reading ?? "—"}</td><td>{student.ks2Maths ?? "—"}</td><td><Grade grade={student.grades.find(g => g.pointId === point?.id)} /></td>{behaviourRows.map(r => <td key={r.label}>{behaviourSnapshot && student.snapshot?.countScope !== behaviourSource ? "—" : behaviourValue(student, r.label)}</td>)}</tr>)}</tbody></table></TableScrollRegion>{!visible.length && <p className="py-10 text-center text-sm text-muted">No pupils match this measure or search.</p>}</div><p className="border-t border-border px-6 py-4 text-xs text-muted">Attendance and behaviour describe these pupils across all lessons. Behaviour: {behaviourSnapshot?.label ?? `events in the last ${windowDays} days`}. Award points are points earned, rather than a count of awards. Missing scores are excluded from averages.</p>
    </section>
    <section className="class-panel p-5 sm:p-6" aria-labelledby="class-attainment-heading">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><h2 id="class-attainment-heading" className="text-lg font-semibold">Subject attainment</h2><p className="mt-1 text-sm text-muted">{data.subject} · Assessment history for the current class roster.</p></div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <div className="class-field min-w-[180px] flex-1"><label htmlFor="class-cycle">Assessment cycle</label><select className="field" id="class-cycle" value={cycleId} disabled={!cycles.length} onChange={e => { setSelection(null); setCycleId(e.target.value); setPointId(data.points.find(p => p.cycleId === e.target.value)?.id ?? ""); }}>{!cycles.length && <option>No recorded cycles</option>}{cycles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="class-field min-w-[180px] flex-1"><label htmlFor="class-point">Chart assessment</label><select className="field" id="class-point" value={point?.id ?? ""} disabled={!cyclePoints.length} onChange={e => { setPointId(e.target.value); setSelection(null); }}>{!cyclePoints.length && <option>No recorded assessments</option>}{cyclePoints.map(p => <option key={p.id} value={p.id}>{p.label} · {p.format.replaceAll("_", " ")}{p.maxScore ? ` / ${p.maxScore}` : ""}</option>)}</select></div>
        </div>
      </div>
      {point && <p className="mt-4 text-xs text-muted">Chart: {point.label} · {date(point.date)} · {point.status.toLowerCase()} · {validGrades.length} valid results. {data.count - validGrades.length} pupils without a valid present result.</p>}
      {!historyPoints.length ? <p className="py-10 text-center text-sm text-muted">No assessment results linked to this subject yet.</p> : <div className="mt-5"><TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><caption className="sr-only">{data.subject} results for every pupil in {data.name}</caption><thead><tr><th scope="col">Pupil</th>{historyPoints.map(p => <th scope="col" key={p.id}><span>{p.label}</span><span className="mt-1 block text-[10px] font-normal normal-case tracking-normal">{date(p.date)} · {p.format.replaceAll("_", " ")}{p.maxScore ? ` / ${p.maxScore}` : ""} · {p.status.toLowerCase()}</span></th>)}</tr></thead><tbody>{data.students.map(student => <tr key={student.id}><th scope="row" className="whitespace-nowrap font-medium">{student.name}</th>{historyPoints.map(p => <td key={p.id}><Grade grade={student.grades.find(g => g.pointId === p.id)} /></td>)}</tr>)}</tbody></table></TableScrollRegion></div>}
    </section>
    <details className="class-panel group p-5 sm:p-6"><summary className="cursor-pointer text-sm font-semibold focus-visible:outline-accent">Latest cumulative behaviour totals <span className="ml-2 text-xs font-normal text-muted">Expand pupil snapshots</span></summary><p className="mt-3 text-xs text-muted">Totals retain their original reporting period. They are separate from the {windowDays}-day event counts above.</p><div className="mt-5"><TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><caption className="sr-only">Latest cumulative behaviour snapshots</caption><thead><tr>{["Pupil", "Snapshot / period", "Positive points", "Negative points", "Detentions", "On calls", "Lateness", "Internal exclusions", "Suspensions"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.students.map(student => <tr key={student.id}><th scope="row" className="whitespace-nowrap font-medium">{student.name}</th><td className="text-xs text-muted">{student.snapshot ? <>{date(student.snapshot.snapshotDate)}<span className="mt-1 block whitespace-nowrap">{scopeLabels[student.snapshot.countScope] ?? student.snapshot.countScope}</span></> : "Not recorded"}</td>{(["positivePointsTotal", "negativePointsTotal", "detentionsCount", "onCallsCount", "latenessCount", "internalExclusionsCount", "suspensionsCount"] as const).map(key => <td key={key} className="tabular-nums">{student.snapshot?.[key] ?? "—"}</td>)}</tr>)}</tbody></table></TableScrollRegion></div></details>
  </>;
}
