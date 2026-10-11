import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buildViewerContext } from "@/lib/viewerContext";
import { canViewExplorer, canViewAssessmentExplorer } from "@/modules/authz";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";
import { PageHeader } from "@/components/ui/page-header";
import { formatYearGroup } from "@/modules/observations/yearGroup";
import styles from "./page.module.css";

const index = (v:number|null) => v===null?"—":(v*100).toFixed(1);
const change = (v:number|null) => v===null?"No comparison":(v>0?"+":"")+(v*100).toFixed(1)+" index points";
export default async function AttainmentInsights({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams;
  const value = (key:string) => {const v=params[key];return (Array.isArray(v)?v[0]:v)??"";};
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId,"ANALYSIS");
  const viewer = await buildViewerContext(user);
  if(!canViewExplorer(viewer)||!canViewAssessmentExplorer(viewer))notFound();
  const cycles = await prisma.assessmentCycle.findMany({where:{tenantId:user.tenantId,isActive:true},select:{id:true,label:true,points:{where:{resultStatus:{in:["VALIDATED","PUBLISHED","LOCKED"]}},orderBy:{ordinal:"asc"},select:{id:true,label:true,assessedAt:true}}},orderBy:{label:"asc"}});
  const selected = cycles.find(c=>c.id===value("cycle"))??cycles.find(c=>c.points.length)??cycles[0];
  const data = selected?await computeAssessmentAnalysis(user.tenantId,{cycleId:selected.id}):null;
  const view = ["subjects","groups","students"].includes(value("view"))?value("view"):"overview";
  const current = selected?.points.at(-1);
  const previous = selected?.points.at(-2);
  const query = new URLSearchParams({view});
  if(selected)query.set("cycle",selected.id);
  for(const k of ["subject","yearGroup","q","movement","send","pp"])if(value(k))query.set(k,value(k));
  const href=(changes:Record<string,string>)=>{const n=new URLSearchParams(query);n.delete("page");for(const [k,v]of Object.entries(changes))v?n.set(k,v):n.delete(k);return "/insights/attainment?"+n.toString();};
  const subjects=[...new Set(data?.students.flatMap(s=>s.subjects.map(r=>r.subject))??[])].sort();
  const years=[...new Set(data?.students.map(s=>s.yearGroup).filter((y):y is string=>Boolean(y))??[])].sort();
  const filtered=(data?.students??[]).filter(s=>(!value("yearGroup")||s.yearGroup===value("yearGroup"))&&(!value("q")||s.studentName.toLowerCase().includes(value("q").toLowerCase()))&&(!value("send")||s.sendFlag)&&(!value("pp")||s.ppFlag))
    .map(s=>({...s,subjects:s.subjects.filter(r=>!value("subject")||r.subject===value("subject"))})).filter(s=>s.subjects.length);
  const results=filtered.flatMap(s=>s.subjects);
  const comparable=results.filter(r=>r.movement!==null);
  const declining=filtered.filter(s=>s.subjects.some(r=>r.movementLabel==="DECLINING"));
  const improving=filtered.filter(s=>s.subjects.some(r=>r.movementLabel==="IMPROVING"));
  const studentRows=filtered.filter(s=>!value("movement")||s.subjects.some(r=>r.movementLabel===value("movement"))).sort((a,b)=>a.studentName.localeCompare(b.studentName));
  const pageCount=Math.max(1,Math.ceil(studentRows.length/25));
  const page=Math.min(pageCount,Math.max(1,Number.parseInt(value("page"),10)||1));
  const from = "/insights/attainment?"+query.toString()+"&page="+page;
  const grouped=subjects.filter(s=>!value("subject")||s===value("subject")).map(subject=>{
    const entries=results.filter(r=>r.subject===subject);
    const scores=entries.filter(r=>r.normalizedScore!==null);
    const movements=entries.filter(r=>r.movement!==null);
    return {subject,count:entries.length,mean:scores.length?scores.reduce((sum,r)=>sum+r.normalizedScore!,0)/scores.length:null,movement:movements.length?movements.reduce((sum,r)=>sum+r.movement!,0)/movements.length:null,comparisons:movements.length};
  }).filter(s=>s.count);
  const studentList=(rows:typeof studentRows)=><div className={styles.rows}>{rows.map(s=><Link className={styles.row} key={s.studentId} href={`/students/${s.studentId}?from=${encodeURIComponent(from)}#attainment`}><div><h3>{s.studentName}</h3><p>{formatYearGroup(s.yearGroup)}{s.sendFlag?" · SEND":""}{s.ppFlag?" · Pupil premium":""}</p></div><div><span className={styles.status}>{s.subjects.filter(r=>r.movementLabel==="DECLINING").length} declining · {s.subjects.filter(r=>r.movementLabel==="IMPROVING").length} improving subjects</span><p>{s.subjects.filter(r=>r.movement!==null).length} of {s.subjects.length} subjects have a comparison</p></div><span aria-hidden="true">→</span></Link>)}</div>;
  return <div className={styles.page}>
    <Link className={styles.back} href="/insights">← Insights</Link>
    <PageHeader variant="ledger" title="Attainment insights" subtitle="Understand results, find patterns and review the students behind them." actions={<Link className={styles.workspace} href={selected?"/assessments/"+selected.id:"/assessments"}>Assessment workspace ↗</Link>}/>
    <div className={styles.viewBar}><nav className={styles.tabs} aria-label="Attainment insight views">{[["overview","Overview"],["subjects","Subjects"],["groups","Groups"],["students","Students"]].map(([v,l])=><Link key={v} href={href({view:v,q:"",movement:""})} aria-current={view===v?"page":undefined}>{l}</Link>)}</nav></div>
    <section className={styles.controls} aria-label="Assessment dataset and filters"><form action="/insights/attainment"><input type="hidden" name="view" value={view}/><div className={styles.fields}>
      <label>Assessment cycle<select name="cycle" defaultValue={selected?.id}>{!cycles.length&&<option value="">No assessment cycles</option>}{cycles.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label>Subject<select name="subject" defaultValue={value("subject")}><option value="">All subjects</option>{subjects.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Year group<select name="yearGroup" defaultValue={value("yearGroup")}><option value="">All year groups</option>{years.map(y=><option key={y} value={y}>{formatYearGroup(y)}</option>)}</select></label>
      {view==="students"&&<><label>Student name<input type="search" name="q" defaultValue={value("q")} placeholder="Find a student…"/></label><label>Subject movement<select name="movement" defaultValue={value("movement")}><option value="">All movements</option><option value="DECLINING">At least one decline</option><option value="IMPROVING">At least one improvement</option><option value="NO_PRIOR">Missing previous result</option></select></label></>}
    </div><button type="submit">Apply</button><Link className={styles.clear} href={href({subject:"",yearGroup:"",q:"",movement:"",send:"",pp:""})}>Clear</Link></form></section>
    <div className={styles.comparison}><span className={styles.dot} aria-hidden="true"/><div><strong>{previous?previous.label:"No previous result point"} <span aria-hidden="true">→</span> {current?.label??"No eligible results"}</strong><p>{previous?previous.assessedAt.toLocaleDateString("en-GB")+" → ":""}{current?.assessedAt.toLocaleDateString("en-GB")??"Upload or publish results in the assessment workspace."} · Assessment dates are independent of the observation and pastoral comparison periods.</p></div>{selected&&previous&&current&&<Link href={`/assessments/${selected.id}/compare?from=${previous.id}&to=${current.id}`}>Compare points →</Link>}</div>
    {!current?<p className={styles.empty}>This cycle has no validated, published or locked result points yet.</p>:<>
      {(view==="overview")&&<>
        <div className={styles.summary}>{[[filtered.length,"Students with results"],[comparable.length,"Comparable subject results"],[previous?declining.length:"—","Students with a subject decline"]].map(([n,l])=><div key={l}><span>{l}</span><strong>{n}</strong></div>)}</div>
        <div className={styles.heading}><h2>Worth a closer look</h2><Link href={href({view:"students",movement:"DECLINING"})}>View declining results →</Link></div>
        <p className={styles.note}>Students can improve in one subject and decline in another. {improving.length} students have at least one improving subject. Missing comparisons are excluded from change calculations.</p>
        {declining.length?studentList(declining.slice(0,5)):<p className={styles.empty}>{previous?"No subject declines were identified in the selected results.":"A previous result point is needed to identify changes."}</p>}
      </>}
      {view==="subjects"&&<><div className={styles.heading}><h2>Subject patterns</h2></div><p className={styles.note}>Scores are normalised to a 0–100 index to compare grade scales; these are not percentages correct. Open a subject to see its students.</p><div className={styles.rows}>{grouped.length?grouped.map(s=><Link className={styles.row} key={s.subject} href={href({view:"students",subject:s.subject})}><div><h3>{s.subject}</h3><p>{s.count} subject results · {s.comparisons} comparisons</p></div><div><span className={styles.status}>Current index {index(s.mean)}</span><p>{change(s.movement)}</p></div><span aria-hidden="true">→</span></Link>):<p className={styles.empty}>No subject results match these filters.</p>}</div></>}
      {view==="groups"&&<><div className={styles.heading}><h2>Group differences</h2></div><p className={styles.note}>Year group and subject comparisons use the existing cohort calculation. SEND and pupil-premium gaps compare normalised means; small groups may have no reported gap.</p><div className={styles.rows}>{(data?.cohorts??[]).filter(c=>(!value("subject")||c.subject===value("subject"))&&(!value("yearGroup")||c.yearGroup===value("yearGroup"))).map(c=><Link className={styles.row} key={c.yearGroup+c.subject} href={href({view:"students",yearGroup:c.yearGroup,subject:c.subject})}><div><h3>{formatYearGroup(c.yearGroup)} · {c.subject}</h3><p>{c.studentCount} students · {c.decliningCount} declining · {c.improvingCount} improving</p></div><div><span className={styles.status}>{change(c.movement)}</span><p>SEND gap {c.sendGap===null?"not available":(c.sendGap*100).toFixed(1)+" points"} · PP gap {c.ppGap===null?"not available":(c.ppGap*100).toFixed(1)+" points"}</p></div><span aria-hidden="true">→</span></Link>)}</div></>}
      {view==="students"&&<><div className={styles.heading}><h2>Student results</h2><span>{studentRows.length} students · Name A–Z</span></div>{studentRows.length?studentList(studentRows.slice((page-1)*25,page*25)):<p className={styles.empty}>No students match these filters.</p>}<nav className={styles.pagination} aria-label="Student result pages">{page>1&&<Link href={href({page:String(page-1)})}>← Previous</Link>}<span>Page {page} of {pageCount}</span>{page<pageCount&&<Link href={href({page:String(page+1)})}>Next →</Link>}</nav></>}
    </>}
    <details className={styles.advanced}><summary>Advanced analysis and evidence</summary><div><Link href={`/insights/attainment/evidence?cycle=${selected?.id??""}`}>Detailed analysis and exports →</Link><Link href={`/insights/attainment/group-evidence?cycle=${selected?.id??""}`}>Full group breakdown →</Link><Link href={`/insights/attainment/teacher-evidence?cycle=${selected?.id??""}`}>Teacher attribution →</Link><Link href="/assessments/triangulation">Pastoral and attainment evidence →</Link></div><p>Teacher attribution and pastoral associations need contextual review and do not establish causation.</p></details>
  </div>;
}
