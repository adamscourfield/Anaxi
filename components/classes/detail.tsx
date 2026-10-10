"use client";
import { useMemo, useState } from "react";
import { TableScrollRegion } from "@/components/ui/table-scroll-region";
import { BarChart, AttendanceRing } from "./charts";
import { attendanceBand } from "@/modules/classes/metrics";
import { defaultClassLabels, type ClassLabels } from "@/modules/classes/presentation";
import type { ClassData } from "@/modules/classes/data";

type Pupil = ClassData["students"][number];
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export function ClassDetail({ data, windowDays, labels = defaultClassLabels }: { data: ClassData; windowDays: number; labels?: ClassLabels }) {
  const [pointId, setPointId] = useState(data.points[0]?.id ?? "");
  const point = data.points.find(p => p.id === pointId);
  const [scope, setScope] = useState(data.behaviourSnapshots[0]?.scope ?? "events");
  const snapshot = data.behaviourSnapshots.find(s => s.scope === scope);
  const [selection, setSelection] = useState<{ label: string; ids: string[] } | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const definitions = [
    { key: "positive", label: labels.positive, field: "positivePointsTotal", event: "positivePoints", tone: "positive", symbol: "✦", unit: "points" },
    { key: "detention", label: labels.detention, field: "detentionsCount", event: "DETENTION", tone: "negative", symbol: "◷", unit: "recorded" },
    { key: "onCall", label: labels.onCall, field: "onCallsCount", event: "ON_CALL", tone: "neutral", symbol: "↗", unit: "recorded" },
    { key: "lateness", label: labels.lateness, field: "latenessCount", event: "LATENESS", tone: "warning", symbol: "◴", unit: "recorded" },
    { key: "internalExclusion", label: labels.internalExclusion, field: "internalExclusionsCount", event: "INTERNAL_EXCLUSION", tone: "negative", symbol: "⊖", unit: "recorded" },
    { key: "suspension", label: labels.suspension, field: "suspensionsCount", event: "SUSPENSION", tone: "negative", symbol: "⊘", unit: "recorded" },
  ] as const;
  function behaviourValue(s: Pupil, measure: typeof definitions[number]): number | null {
    if (snapshot) return s.behaviourSnapshot?.countScope === scope ? s.behaviourSnapshot[measure.field] : null;
    if (data.behaviourPending || !Object.keys(data.events).length) return null;
    return s.events[measure.event] ?? 0;
  }
  const measures = definitions.map(def => {
    const values = data.students.flatMap(s => { const value = behaviourValue(s, def); return value === null ? [] : [value]; });
    return { ...def, value: values.length ? values.reduce((a,b)=>a+b,0) : null, pupils: values.filter(n=>n>0).length, coverage: values.length };
  });
  function select(label: string, predicate: (student: Pupil) => boolean) {
    setSelection({ label, ids: data.students.filter(predicate).map(s=>s.id) });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("class-roster-heading")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }
  const visible = useMemo(() => data.students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) && (!selection || selection.ids.includes(s.id))).sort((a,b) => sort === "attendance" ? (a.snapshot?.attendancePct ?? 101) - (b.snapshot?.attendancePct ?? 101) : a.name.localeCompare(b.name)), [data.students, search, selection, sort]);
  function grade(s: Pupil) { return s.grades.find(g=>g.pointId===pointId); }
  const scores = data.students.flatMap(s => { const g=grade(s); return g?.valid && g.status === "PRESENT" && g.normalizedScore !== null ? [g.normalizedScore] : []; });
  const mean = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null;
  function formatScore(n: number | null) {
    if (n === null) return "—";
    if (point?.format === "GCSE") return (n*9).toFixed(1);
    if (point?.format === "A_LEVEL") return `${(n*7).toFixed(1)} / 7`;
    if (point?.format === "RAW") return `${(n*(point.maxScore??1)).toFixed(1)} / ${point.maxScore}`;
    return `${(n*100).toFixed(1)}${point?.format === "INDEX" ? " / 100" : "%"}`;
  }
  const ks2 = (s:Pupil) => s.ks2Reading !== null && s.ks2Maths !== null ? (s.ks2Reading+s.ks2Maths)/2 : null;
  const ks2Scores = data.students.flatMap(s=>{const n=ks2(s);return n===null?[]:[n];});
  function ks2Band(s:Pupil) {const n=ks2(s);return n===null?"Not recorded":n<100?"Below 100":n<110?"100–109":"110 and above";}
  const binLabels = point?.format === "INDEX" ? ["0–19", "20–39", "40–59", "60–79", "80–100"] : ["0–19%", "20–39%", "40–59%", "60–79%", "80–100%"];
  function gradeBand(s:Pupil) {const g=grade(s); if(!g?.valid || g.status!=="PRESENT")return "Not recorded";return ["PERCENTAGE","RAW","INDEX"].includes(point?.format??"") && g.normalizedScore!==null ? binLabels[Math.min(4,Math.max(0,Math.floor(g.normalizedScore*5)))] : g.value?.trim()??"Not recorded";}
  const distribution = [...new Set(data.students.map(gradeBand))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(label=>({label,value:data.students.filter(s=>gradeBand(s)===label).length}));
  const bands = [{label:"95–100%",color:"var(--success)"},{label:"90–94.9%",color:"var(--warning)"},{label:"Below 90%",color:"var(--error)"}].map(b=>({...b,value:data.students.filter(s=>s.snapshot && attendanceBand(s.snapshot.attendancePct)===b.label).length}));
  const kpis = [
    { label:"Class attendance", value:data.attendance.value===null?"—":`${data.attendance.value.toFixed(1)}%`, note:`${data.attendance.count} of ${data.count} pupils · cumulative`, tone:"attendance" },
    { label:"KS2 scaled score", value:ks2Scores.length?(ks2Scores.reduce((a,b)=>a+b,0)/ks2Scores.length).toFixed(1):"—", note:`Reading & maths mean · ${ks2Scores.length}/${data.count} pupils`, tone:"prior" },
    { label:"Average attainment", value:formatScore(mean), note:`${scores.length}/${data.count} pupils · ${point?.label??"Awaiting assessment results"}`, tone:"attainment" },
  ];
  return <>
    <div className="class-kpis">{kpis.map(k=><section key={k.label} className={`class-kpi class-kpi-${k.tone}`}><p className="class-kicker">{k.label}</p><strong>{k.value}</strong><p className="text-xs leading-relaxed text-muted">{k.note}</p></section>)}</div>
    <section className="class-panel class-behaviour" aria-labelledby="class-behaviour-heading">
      <div className="class-section-heading"><div><p className="class-kicker">CULTURE & ENGAGEMENT</p><h2 id="class-behaviour-heading">Behaviour overview</h2><p className="text-xs text-muted">{snapshot ? `${snapshot.label} · ${snapshot.pupils}/${data.count} pupils` : data.behaviourPending ? "Arbor behaviour import has not completed yet" : `Individual records · last ${windowDays} days`}{data.behaviourThrough && snapshot ? ` · through ${date(data.behaviourThrough)}` : ""}</p></div><div className="class-field"><label className="sr-only" htmlFor="behaviour-source">Behaviour period</label><select className="field" id="behaviour-source" value={scope} onChange={e=>{setScope(e.target.value);setSelection(null);}}>{!data.behaviourSnapshots.length && <option value="events">{data.behaviourPending ? "Import pending" : `Last ${windowDays} days`}</option>}{data.behaviourSnapshots.map(s=><option key={s.scope} value={s.scope}>{s.label}</option>)}{!!Object.keys(data.events).length && !!data.behaviourSnapshots.length && <option value="events">Events · last {windowDays} days</option>}</select></div></div>
      <div className="class-behaviour-grid">{measures.map(m=><button type="button" key={m.key} className={`class-measure class-measure-${m.tone}`} disabled={m.value===null} onClick={()=>select(m.label,s=>(behaviourValue(s,m)??0)>0)} aria-label={`${m.label}: ${m.value??"not available"}. Show pupils`}><span className="class-measure-top"><span className="class-measure-symbol" aria-hidden="true">{m.symbol}</span><span className="class-measure-label">{m.label}</span></span><strong>{m.value??"—"}</strong><span className="class-measure-caption">{m.value===null ? "Awaiting data" : `${m.pupils} ${m.pupils===1?"pupil":"pupils"} · ${m.unit}`}</span><span className="class-measure-track" aria-hidden="true"><span style={{width:`${m.coverage?m.pupils/m.coverage*100:0}%`}} /></span><span className="class-measure-link">View pupils <span aria-hidden="true">↗</span></span></button>)}</div>
      <p className="class-footnote">Select a measure to explore its pupils. {labels.positive} is a points total. Figures cover these pupils across all lessons.</p>
    </section>
    <div className="class-content-grid">
      <div className="min-w-0 space-y-5">
        <section className="class-panel class-roster" aria-labelledby="class-roster-heading">
          <div className="class-section-heading"><div><p className="class-kicker">THE CLASS</p><h2 id="class-roster-heading">Pupils <span className="class-count">{data.count}</span></h2><p className="text-xs text-muted" role="status">{selection ? `${visible.length} pupils · ${selection.label}` : "Attendance, prior attainment and current outcomes"}</p></div>{selection && <button type="button" className="class-page-button" onClick={()=>{setSelection(null);setSearch("");}}>Show all pupils</button>}</div>
          <div className="class-roster-tools"><div className="class-search"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5"/></svg><input aria-label="Find a pupil" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a pupil…" /></div><select aria-label="Sort pupils" value={sort} onChange={e=>setSort(e.target.value)} className="class-sort"><option value="name">A–Z</option><option value="attendance">Lowest attendance</option></select></div>
          <TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><caption className="sr-only">Class pupil outcomes</caption><thead><tr><th scope="col">Pupil</th><th scope="col">Attendance</th><th scope="col">KS2 mean</th><th scope="col">Attainment</th><th scope="col">{labels.positive}</th><th scope="col">{labels.detention}</th></tr></thead><tbody>{visible.map(s=><tr key={s.id}><th scope="row"><div className="class-pupil"><span className="class-pupil-avatar" aria-hidden="true">{s.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><span>{s.name}<span className="block text-[11px] font-normal text-muted">{s.yearGroup}</span></span></div></th><td><span className={`class-attendance-value ${s.snapshot && s.snapshot.attendancePct<90?"text-error":""}`}>{s.snapshot?`${s.snapshot.attendancePct.toFixed(1)}%`:"—"}</span><span className="class-cell-track" aria-hidden="true"><span style={{width:`${s.snapshot?.attendancePct??0}%`,background:s.snapshot && s.snapshot.attendancePct<90?"var(--error)":"var(--success)"}}/></span></td><td><strong className="font-medium tabular-nums">{ks2(s)?.toFixed(1)??"—"}</strong><span className="block whitespace-nowrap text-[10px] text-muted">R {s.ks2Reading??"—"} / M {s.ks2Maths??"—"}</span></td><td><span className="class-grade">{grade(s)?.valid && grade(s)?.status==="PRESENT"?grade(s)?.value:"—"}</span></td>{measures.slice(0,2).map(m=><td key={m.key}><span className={`class-number class-number-${m.tone}`}>{behaviourValue(s,m)??"—"}</span></td>)}</tr>)}</tbody></table></TableScrollRegion>{!visible.length && <p className="p-10 text-center text-sm text-muted">No pupils match this selection.</p>}<div className="class-roster-footer"><span>{visible.length} of {data.count} pupils</span><span>Missing data excluded from averages</span></div>
        </section>
        <details className="class-panel class-history"><summary><span>Assessment results</span><span className="text-xs font-normal text-muted">Choose a dataset or explore subject results ↓</span></summary><div className="space-y-4 pt-4"><div className="class-field"><label htmlFor="class-point">Assessment dataset</label><select className="field" id="class-point" value={pointId} disabled={!data.points.length} onChange={e=>{setPointId(e.target.value);setSelection(null);}}>{!data.points.length && <option value="">No recorded assessments</option>}{data.points.map(p=><option key={p.id} value={p.id}>{p.cycle} · {p.label}</option>)}</select></div>{point && <p className="text-xs text-muted">{date(point.date)} · {point.status.toLowerCase()} · {point.format === "INDEX" ? "Normalized index across subject scales" : point.format.replaceAll("_"," ")}. Current roster, valid present results only.</p>}<TableScrollRegion stickyFirstColumn><table className="class-table w-full text-left text-sm"><thead><tr><th scope="col">Pupil</th>{data.points.filter(p=>p.cycleId===point?.cycleId).map(p=><th scope="col" key={p.id}>{p.label}</th>)}</tr></thead><tbody>{data.students.map(s=><tr key={s.id}><th scope="row">{s.name}</th>{data.points.filter(p=>p.cycleId===point?.cycleId).map(p=>{const g=s.grades.find(g=>g.pointId===p.id);return <td key={p.id}>{g?.valid&&g.status==="PRESENT"?g.value:"—"}</td>;})}</tr>)}</tbody></table></TableScrollRegion></div></details>
      </div>
      <aside className="class-insights space-y-5" aria-label="Class insights">
        <AttendanceRing bands={bands} missing={data.count-data.attendance.count} onSelect={label=>select(`Attendance · ${label}`,s=>label==="No attendance data"?!s.snapshot:!!s.snapshot&&attendanceBand(s.snapshot.attendancePct)===label)} />
        <BarChart title="Attainment profile" subtitle={point?`${point.cycle} · ${point.label}`:"Awaiting assessment results"} rows={distribution} onSelect={label=>select(`Attainment · ${label}`,s=>gradeBand(s)===label)} />
        <BarChart title="Prior attainment" subtitle="KS2 reading & maths mean" rows={["Below 100","100–109","110 and above","Not recorded"].map(label=>({label,value:data.students.filter(s=>ks2Band(s)===label).length}))} onSelect={label=>select(`KS2 · ${label}`,s=>ks2Band(s)===label)} />
      </aside>
    </div>
  </>;
}
