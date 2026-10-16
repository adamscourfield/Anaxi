import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buildViewerContext } from "@/lib/viewerContext";
import { canViewExplorer, canViewStudentAnalysis, canViewAssessmentExplorer, canViewTeacherAnalysis } from "@/modules/authz";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { computeTeacherRiskIndex } from "@/modules/analysis/teacherRisk";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";
import { getTenantVocab } from "@/lib/vocab";
import styles from "./page.module.css";

const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("");
const date = (value: Date | null) => value ? value.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) : "No dated evidence";

function AreaIcon({ kind }: { kind: "students" | "teaching" | "attainment" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==="students"?<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>:kind==="teaching"?<><path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15"/></>:<><path d="M4 20h17M7 16v-5M12 16V7M17 16V3"/></>}
  </svg>;
}

export default async function InsightsPage({ searchParams }: {
  searchParams: Promise<Record<string,string|string[]|undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.windowDays) ? params.windowDays[0] : params.windowDays;
  const windowDays = [7,21,28].includes(Number(raw)) ? Number(raw) : 21;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId,"ANALYSIS");
  const viewer = await buildViewerContext(user);
  if (!canViewExplorer(viewer)) notFound();
  const [studentResult, teachers, assessment, memberships, vocab] = await Promise.all([
    canViewStudentAnalysis(viewer) ? computeStudentRiskIndex(user.tenantId,windowDays,user.id,"ACTIVE") : null,
    computeTeacherRiskIndex(user.tenantId,windowDays),
    canViewAssessmentExplorer(viewer) ? computeAssessmentAnalysis(user.tenantId) : null,
    prisma.departmentMembership.findMany({where:{tenantId:user.tenantId},select:{userId:true,departmentId:true}}),
    getTenantVocab(user.tenantId),
  ]);
  const teacherDepartments = new Map<string,string[]>();
  memberships.forEach(m=>teacherDepartments.set(m.userId,[...(teacherDepartments.get(m.userId)??[]),m.departmentId]));
  const visibleTeachers = teachers.filter(t=>canViewTeacherAnalysis(viewer,{teacherUserId:t.teacherMembershipId,teacherDepartmentIds:teacherDepartments.get(t.teacherMembershipId)??[]}));
  const teacherConcerns = visibleTeachers.filter(t=>t.status==="SIGNIFICANT_DRIFT"||t.status==="EMERGING_DRIFT").sort((a,b)=>b.normalizedIDS-a.normalizedIDS);
  const studentRows = studentResult?.rows??[];
  const studentConcerns = studentRows.filter(s=>s.band==="URGENT"||s.band==="PRIORITY").sort((a,b)=>b.riskScore-a.riskScore);
  const declineStudents = assessment?.students.filter(s=>s.subjects.some(r=>r.movementLabel==="DECLINING"))??[];
  const reasons: Record<string,string> = {attendance:"Attendance has fallen",detentions:vocab.detentions.plural+" have increased",onCalls:vocab.on_calls.plural+" have increased",suspensions:vocab.suspensions.plural+" have increased",internalExclusions:vocab.internal_exclusions.plural+" have increased",lateness:"Lateness has increased"};
  const studentHref = `/insights/students?windowDays=${windowDays}`;
  const teachingHref = `/insights/teaching?windowDays=${windowDays}`;
  const attainmentHref = "/insights/attainment";
  return <div className={styles.page}>
    <PageHeader variant="ledger" className={styles.header} eyebrow="School intelligence" title="Insights" subtitle="See what deserves a closer look, then explore the evidence." actions={
      <div className={styles.period}><span>Comparison period</span><nav aria-label="Insights comparison period">{[7,21,28].map(w=><Link key={w} href={`/insights?windowDays=${w}`} aria-current={w===windowDays?"page":undefined}>{w}d</Link>)}</nav></div>
    } />
    <nav className={styles.areas} aria-label="Insight areas">
      {[{kind:"teaching" as const,name:"Teaching",href:teachingHref,description:"Lesson patterns and professional development",count:teacherConcerns.length,label:teacherConcerns.length===1?"teacher to review":"teachers to review"},
        {kind:"students" as const,name:"Students",href:studentHref,description:"Attendance, behaviour and individual priorities",count:studentConcerns.length,label:"students needing attention"},
        {kind:"attainment" as const,name:"Attainment",href:attainmentHref,description:"Assessment outcomes, subjects and groups",count:assessment?.cycles.some(c=>c.previousPointLabel)?declineStudents.length:"—",label:assessment?.cycles.some(c=>c.previousPointLabel)?"students with declining subject results":"no assessment comparison available"}
      ].map(a=><Link className={`${styles.area} ${a.kind === "teaching" ? styles.featured : ""}`} href={a.href} key={a.kind}><div className={styles.areaTitle}><span className={styles.icon}><AreaIcon kind={a.kind}/></span><h2>{a.name}</h2><span className={styles.arrow}>↗</span></div><p>{a.description}</p><div className={styles.areaCount}><strong>{a.count}</strong><span>{a.label}</span></div><div className={styles.areaFooter}><span>Explore {a.name.toLowerCase()}</span><span aria-hidden="true">→</span></div></Link>)}
    </nav>
    <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>Your review queue</span><h2>Worth a closer look</h2><p>Priorities from the available evidence, grouped by area.</p></div><span className={styles.windowNote}>Last {windowDays} days · compared with preceding {windowDays}</span></div>
    <div className={styles.findingsGrid}>
    <section className={styles.section} aria-labelledby="student-changes">
      <div className={styles.sectionHead}><span className={styles.sectionIcon}><AreaIcon kind="students"/></span><h3 id="student-changes">Students</h3><Link href={studentHref}>View student insights →</Link></div>
      {!studentConcerns.length?<p className={styles.empty}>{studentRows.length?"No students are in the priority or urgent bands. You can still review all students.":"No active student snapshots are available yet."}</p>:
        studentConcerns.slice(0,3).map(s=><Link className={styles.finding} key={s.studentId} href={`/students/${s.studentId}?window=${windowDays}&from=${encodeURIComponent("/insights?windowDays="+windowDays)}#pastoral-evidence`}><span className={styles.avatar} aria-hidden="true">{initials(s.studentName)}</span><div><h4>{s.studentName}</h4><p>{s.drivers.length?s.drivers.map(d=>reasons[d.metric]??d.label).join(" · "):"Review the recorded priority indicators"}</p><span>Snapshot {date(s.lastSnapshotDate)}{s.confidence==="LOW"?" · Limited comparison evidence":""}</span></div><span className={`${styles.tag} ${s.band === "URGENT" ? styles.urgent : ""}`}>{s.band==="URGENT"?"Urgent":"Priority"} <span aria-hidden="true">→</span></span></Link>)}
      <p className={styles.caption}>Latest snapshots; changes compare the selected {windowDays}-day periods. Snapshot counts are not incident totals within that period.</p>
    </section>
    <section className={styles.section} aria-labelledby="teaching-changes">
      <div className={styles.sectionHead}><span className={styles.sectionIcon}><AreaIcon kind="teaching"/></span><h3 id="teaching-changes">Teaching</h3><Link href={teachingHref}>Review teaching →</Link></div>
      {!teacherConcerns.length?<p className={styles.empty}>{visibleTeachers.some(t=>t.status!=="LOW_COVERAGE")?"No teachers crossed the decline thresholds in this period.": "There are not enough observations for a reliable comparison yet."}</p>:
        teacherConcerns.slice(0,3).map(t=><Link key={t.teacherMembershipId} className={styles.finding} href={`/analysis/teachers/${t.teacherMembershipId}?window=${windowDays}`}><span className={styles.avatar} aria-hidden="true">{initials(t.teacherName)}</span><div><h4>{t.teacherName}</h4><p>Observation signals have weakened compared with the previous period.</p><span>{t.teacherCoverage} observations · Last observed {date(t.lastObservationAt)}</span></div><span className={styles.tag}>Review <span aria-hidden="true">→</span></span></Link>)}
      <p className={styles.caption}>{visibleTeachers.filter(t=>t.status==="LOW_COVERAGE").length} teachers have insufficient observations for a reliable comparison. These indicators support review; they are not teacher grades.</p>
    </section>
    <section className={styles.section} aria-labelledby="attainment-changes">
      <div className={styles.sectionHead}><span className={styles.sectionIcon}><AreaIcon kind="attainment"/></span><h3 id="attainment-changes">Attainment</h3><Link href={attainmentHref}>Explore attainment →</Link></div>
      {!assessment?.cycles.some(c=>c.previousPointLabel)?<p className={styles.empty}>No eligible assessment comparisons are available yet.</p>:<div className={styles.assessment}>
        <p>{declineStudents.length? `${declineStudents.length} students have a declining result in at least one subject.`:"No declining subject results were identified in the available comparisons."}</p>
        <p>Assessment comparisons use recorded result points, independently of the {windowDays}-day pastoral and observation period.</p>
        <ul>{assessment.cycles.map(c=><li key={c.cycleId}><strong>{c.cycleLabel}</strong><span>{c.previousPointLabel??"No previous point"} → {c.currentPointLabel}</span></li>)}</ul>
      </div>}
    </section>
    </div>
  </div>;
}
