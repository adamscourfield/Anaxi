import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buildViewerContext } from "@/lib/viewerContext";
import { canViewExplorer, canViewTeacherAnalysis } from "@/modules/authz";
import { computeTeacherRiskIndex } from "@/modules/analysis/teacherRisk";
import { computeDepartmentPivot } from "@/modules/analysis/departmentPivot";
import { computeCpdPriorities } from "@/modules/analysis/cpdPriorities";
import styles from "./page.module.css";

const statusLabels = { SIGNIFICANT_DRIFT:"Signals declining", EMERGING_DRIFT:"Some signals declining", STABLE:"No decline identified", LOW_COVERAGE:"Insufficient observations" };
export default async function TeachingInsights({ searchParams }: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}) {
  const params = await searchParams;
  const value = (key:string) => { const v=params[key]; return (Array.isArray(v)?v[0]:v)??""; };
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId,"ANALYSIS");
  const viewer = await buildViewerContext(user);
  const schoolScope = ["ADMIN","SUPER_ADMIN","SLT"].includes(user.role);
  if (!canViewExplorer(viewer) && !["LEADER","TEACHER"].includes(user.role)) notFound();
  const windowDays = [7,21,28].includes(Number(value("windowDays")))?Number(value("windowDays")):21;
  const view = ["teachers","departments","cpd"].includes(value("view"))?value("view"):"overview";
  const [allTeachers,memberships,departments] = await Promise.all([
    computeTeacherRiskIndex(user.tenantId,windowDays),
    prisma.departmentMembership.findMany({where:{tenantId:user.tenantId},select:{userId:true,departmentId:true}}),
    prisma.department.findMany({where:{tenantId:user.tenantId,...(!schoolScope?{id:{in:viewer.hodDepartmentIds}}:{})},select:{id:true,name:true},orderBy:{name:"asc"}}),
  ]);
  const deptMap = new Map<string,string[]>();
  memberships.forEach(m=>deptMap.set(m.userId,[...(deptMap.get(m.userId)??[]),m.departmentId]));
  const visible = allTeachers.filter(t=>canViewTeacherAnalysis(viewer,{teacherUserId:t.teacherMembershipId,teacherDepartmentIds:deptMap.get(t.teacherMembershipId)??[]}));
  if (!visible.length && !canViewExplorer(viewer)) notFound();
  const department = departments.some(d=>d.id===value("department"))?value("department"):"";
  const cpdDepartment = department || (!schoolScope?departments[0]?.id:"");
  const [pivot,cpd] = await Promise.all([
    (schoolScope||departments.length)?computeDepartmentPivot(user.tenantId,windowDays,schoolScope?(department?[department]:undefined):(department?[department]:departments.map(d=>d.id))):null,
    (schoolScope||cpdDepartment)?computeCpdPriorities(user.tenantId,windowDays,cpdDepartment?{departmentId:cpdDepartment}:undefined):[],
  ]);
  const query = new URLSearchParams({windowDays:String(windowDays),view});
  for (const key of ["department","q","status"]) if(value(key))query.set(key,value(key));
  const path = "/insights/teaching?"+query.toString();
  const href = (changes:Record<string,string>) => {const next=new URLSearchParams(query);for(const [k,v]of Object.entries(changes))v?next.set(k,v):next.delete(k);return "/insights/teaching?"+next.toString();};
  const teachers = visible.filter(t=>(!department||deptMap.get(t.teacherMembershipId)?.includes(department))&&(!value("q")||t.teacherName.toLowerCase().includes(value("q").toLowerCase()))&&(!value("status")||t.status===value("status")))
    .sort((a,b)=>b.normalizedIDS-a.normalizedIDS||a.teacherName.localeCompare(b.teacherName));
  const concerns = teachers.filter(t=>t.status==="SIGNIFICANT_DRIFT"||t.status==="EMERGING_DRIFT");
  const low = teachers.filter(t=>t.status==="LOW_COVERAGE").length;
  const teacherHref = (id:string)=>`/analysis/teachers/${id}?window=${windowDays}&from=${encodeURIComponent(path)}`;
  const teacherList = (rows:typeof teachers)=><div className={styles.rows}>{!rows.length?<p className={styles.empty}>No teachers match this view.</p>:rows.map(t=><Link className={styles.row} key={t.teacherMembershipId} href={teacherHref(t.teacherMembershipId)}><div><h3>{t.teacherName}</h3><p>{t.departmentNames.join(", ")||"No department assigned"}</p></div><div><span className={styles.status}>{statusLabels[t.status]}</span><p>{t.teacherCoverage} observations{t.lastObservationAt?" · Last observed "+t.lastObservationAt.toLocaleDateString("en-GB"):""}</p></div><span aria-hidden="true">→</span></Link>)}</div>;
  return <div className={styles.page}>
    <Link className={styles.back} href={`/insights?windowDays=${windowDays}`}>← Insights</Link>
    <PageHeader variant="ledger" title="Teaching insights" subtitle="Understand lesson patterns, review the evidence and focus professional development." actions={
      <div className={styles.period}><span>Comparison period</span><nav aria-label="Teaching comparison period">{[7,21,28].map(w=><Link key={w} href={href({windowDays:String(w)})} aria-current={w===windowDays?"page":undefined}>{w}d</Link>)}</nav></div>
    } />
    <div className={styles.viewBar}>
      <nav className={styles.tabs} aria-label="Teaching insight views">{[["overview","Overview"],["teachers","Teachers"],["departments","Departments"],["cpd","CPD"]].filter(([v])=>schoolScope||departments.length||v==="overview"||v==="teachers").map(([v,l])=><Link key={v} href={href({view:v,...(v!=="teachers"?{q:"",status:""}:{})})} aria-current={view===v?"page":undefined}>{l}</Link>)}</nav>
    </div>
    {(view==="teachers" || departments.length>0) && <section className={styles.controls} aria-label="Filter teaching evidence">
      <form action="/insights/teaching"><input type="hidden" name="view" value={view}/><input type="hidden" name="windowDays" value={windowDays}/><div className={styles.fields}>
        {departments.length>0&&<label>Department<select name="department" defaultValue={view==="cpd"&&!schoolScope?cpdDepartment:department}>{(view!=="cpd"||schoolScope)&&<option value="">All accessible departments</option>}{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        {view==="teachers"&&<><label>Teacher name<input type="search" name="q" defaultValue={value("q")} placeholder="Find a teacher…"/></label><label>Evidence status<select name="status" defaultValue={value("status")}><option value="">All statuses</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></>}
      </div><button type="submit">Apply</button>{(value("q")||value("status")||value("department"))&&<Link className={styles.clear} href={href({q:"",status:"",department:""})}>Clear</Link>}</form>
    </section>}
    {(view==="overview"||view==="teachers")&&<>
      <div className={styles.summary}>{[[teachers.length,"Teachers in view"],[concerns.length,"Teachers to review"],[low,"Insufficient observations"]].map(([n,l])=><div key={l}><span>{l}</span><strong>{n}</strong></div>)}</div>
      {view==="overview"?<><div className={styles.heading}><h2>Worth a closer look</h2><Link href={href({view:"teachers"})}>View all teachers →</Link></div><p className={styles.note}>Signals have weakened compared with the previous {windowDays}-day period. These indicators guide a conversation; they are not teacher grades.</p>{concerns.length?teacherList(concerns.slice(0,5)):<p className={styles.empty}>{low===teachers.length?"There are not enough observations for a reliable comparison yet.":"No teachers crossed the decline thresholds in this view."}</p>}{(schoolScope||departments.length>0)&&<div className={styles.shortcuts}><Link href={href({view:"departments"})}>Explore department patterns →</Link><Link href={href({view:"cpd"})}>Review shared CPD needs →</Link></div>}</>:<><div className={styles.heading}><h2>Teachers</h2><span>Priority first</span></div>{teacherList(teachers)}</>}
    </>}
    {view==="departments"&&<><div className={styles.heading}><h2>Department patterns</h2></div><p className={styles.note}>Observation counts show where evidence is concentrated. Department averages are available in the detailed breakdown.</p><div className={styles.rows}>{!pivot?.rows.length?<p className={styles.empty}>No accessible departments have been configured.</p>:pivot.rows.map(d=><Link className={styles.row} key={d.departmentId} href={href({view:"teachers",department:d.departmentId,q:"",status:""})}><div><h3>{d.departmentName}</h3><p>{d.teacherCount} teachers</p></div><div><span className={styles.status}>{d.observationCount} observations</span><p>{Object.values(d.signalData).filter(s=>s.delta!==null&&s.delta<0).length} signals with lower averages than the previous period</p></div><span aria-hidden="true">→</span></Link>)}</div><Link className={styles.back} href={`/insights/teaching/departments?windowDays=${windowDays}${department?"&departmentId="+department:""}`}>Open detailed signal breakdown →</Link></>}
    {view==="cpd"&&<><div className={styles.heading}><h2>Professional development</h2></div><p className={styles.note}>Shared observation patterns, ranked using the existing CPD calculation. {cpdDepartment?"Scope: "+departments.find(d=>d.id===cpdDepartment)?.name+".":"Scope: school-wide."} Counts include only teachers with sufficient observations.</p><div className={styles.rows}>{!cpd.some(s=>s.teachersDriftingDown>0)?<p className={styles.empty}>No shared decline was identified with sufficient evidence in this scope.</p>:cpd.filter(s=>s.teachersDriftingDown>0).map(s=><Link className={styles.row} key={s.signalKey} href={`/analysis/cpd/${s.signalKey}?window=${windowDays}${cpdDepartment?"&department="+cpdDepartment:""}&from=${encodeURIComponent(path)}`}><div><h3>{s.label}</h3><p>{s.teachersDriftingDown} of {s.teachersCovered} covered teachers show a decline</p></div><span className={styles.status}>{Math.round(s.driftRate*100)}% of covered teachers</span><span aria-hidden="true">→</span></Link>)}</div></>}
    <details className={styles.advanced}><summary>Detailed evidence and exports</summary><div><Link href={`/insights/teaching/evidence?windowDays=${windowDays}`}>Teacher signal breakdown →</Link><Link href={`/insights/teaching/signals?windowDays=${windowDays}`}>Signal patterns →</Link><Link href={`/insights/teaching/observations?windowDays=${windowDays}`}>Observation records →</Link></div></details>
    <p className={styles.note}>Observation window: last {windowDays} days, compared with the preceding {windowDays} days. Missing or unobserved signals are excluded.</p>
  </div>;
}
