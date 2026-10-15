import Link from "next/link";
import { londonToday } from "@/modules/home/hydration";
import { buildLeaderSummary, buildStudentSummary } from "@/modules/home/leaderSummary";
import type { hydrateLeadershipHomeData } from "@/modules/home/hydration";
import type { fetchLeaderWork } from "@/modules/home/leaderWork";
import { InsightWindowSelector } from "./InsightWindowSelector";
import { IconUsersTwo, IconChartBar, IconClipboard, IconUmbrella, IconPhone, IconCalendar } from "./home-chrome";
import styles from "./LeaderBriefing.module.css";

type Props = {
  data: Awaited<ReturnType<typeof hydrateLeadershipHomeData>>;
  work: Awaited<ReturnType<typeof fetchLeaderWork>>;
  windowDays: number;
  features: { analysis: boolean; students: boolean; assessments: boolean; leave: boolean; onCall: boolean; observations: boolean };
  reasons: Record<string, string>;
};
const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("");
const date = (value: Date | string | null) => value ? new Date(value).toLocaleDateString("en-GB", { day:"numeric", month:"short", timeZone:"Europe/London" }) : "not available";

export function LeaderBriefing({data,work,windowDays,features,reasons}: Props) {
  const attendanceStale = data.attendanceHeadline.asOf
    && londonToday().getTime() - new Date(data.attendanceHeadline.asOf).getTime() > 3 * 86400000;
  const attendanceMissing = data.attendanceTrend.loadError ? "Could not load" : "Missing history";
  const teaching = `/insights/teaching?windowDays=${windowDays}`;
  const students = `/insights/students?windowDays=${windowDays}`;
  const teachersToReview = data.teacherRows.filter(t=>t.status === "SIGNIFICANT_DRIFT" || t.status === "EMERGING_DRIFT");
  const studentsToReview = data.studentRows.filter(s=>s.band === "URGENT" || s.band === "PRIORITY")
    .sort((a,b)=>(a.band === "URGENT" ? 0:1)-(b.band === "URGENT" ? 0:1)||b.riskScore-a.riskScore);
  const cpd = data.cpdRows.find(s=>s.teachersDriftingDown>0);
  const coverage = data.teacherRows.filter(t=>t.status!=="LOW_COVERAGE").length;
  const from = encodeURIComponent(`/home?window=${windowDays}`);
  const concerns = (features.students ? studentsToReview.length : 0)+teachersToReview.length+(cpd?1:0);
  const improvingTeachers = data.teacherRows
    .filter(t => t.momentumStatus === "IMPROVING" && t.status === "STABLE")
    .sort((a, b) => (b.normalizedPositiveIDS ?? 0) - (a.normalizedPositiveIDS ?? 0));
  const strength = data.topImproving.find(signal => signal.teachersImproving > 0);
  const studentSummary = buildStudentSummary({
    attendancePct: features.students ? data.attendanceHeadline.attendancePct : null,
    studentFocusEnabled: features.students,
    studentFocusCount: features.students && data.studentRows.some(s => s.lastSnapshotDate) ? studentsToReview.length : null,
  });
  const summary = buildLeaderSummary({
    attendancePct: null, studentFocusCount: null,
    teacherFocusCount: teachersToReview.length, teachersCovered: coverage,
    focus: cpd, strength,
  });
  return <div className={styles.briefing}>
    {features.analysis && <section className={styles.summary} aria-labelledby="weekly-briefing">
      <div className={styles.head}><div><span className={styles.eyebrow}>Leadership briefing</span><h2 id="weekly-briefing">This week, at a glance</h2></div>
        <div className={styles.period}><span>Teaching evidence</span><InsightWindowSelector windowDays={windowDays} options={[7,21,28]}/></div>
      </div>
      <div className={styles.briefingTopics}>
        {features.students && <div className={styles.briefingTopic}><h3>Student focus</h3><p className={styles.narrative}>{studentSummary.join(" ")}</p><Link href={students}>Review student insights →</Link></div>}
        <div className={styles.briefingTopic}><h3>Teaching focus</h3><p className={styles.narrative}>{summary.join(" ")}</p></div>
      </div>
      <div className={styles.summaryMeta}><span>Auto-generated from live school data</span><span>Teaching: last {windowDays} days vs preceding {windowDays}</span></div>
    </section>}
    {features.analysis && <section aria-labelledby="school-snapshot">
      <div className={styles.head}><h2 id="school-snapshot">School snapshot</h2><span className={styles.eyebrow}>The numbers that matter</span></div>
      <div className={styles.snapshot}>
        {features.students && <Link className={`${styles.stat} ${styles.attendanceStat}`} href={`${students}&view=all&sort=attendance_asc`}>
          <span className={styles.statTitle}><span className={styles.icon}><IconUsersTwo/></span>Attendance</span>
          <strong className={styles.value}>{data.attendanceHeadline.attendancePct === null ? "—" : `${data.attendanceHeadline.attendancePct.toFixed(1)}%`}</strong>
          <p>{data.attendanceHeadline.asOf ? <>Academic year to date · {data.attendanceHeadline.studentsCovered} students<br/>Updated {date(data.attendanceHeadline.asOf)} · Lesson marks</> : "Attendance history is being refreshed"}</p>
          {attendanceStale && <p>Attendance updates are overdue. Ask your administrator to check the school sync.</p>}
          <div className={styles.attendanceComparisons}>
            <span>Last 7 days <b>{data.attendanceTrend.weekPct === null ? attendanceMissing : `${data.attendanceTrend.weekPct.toFixed(1)}%`}</b></span>
            <span>Last 21 days <b>{data.attendanceTrend.threeWeekPct === null ? attendanceMissing : `${data.attendanceTrend.threeWeekPct.toFixed(1)}%`}</b></span>
            <span>Last 28 days <b>{data.attendanceTrend.monthPct === null ? attendanceMissing : `${data.attendanceTrend.monthPct.toFixed(1)}%`}</b></span>
          </div>
          {data.attendanceTrend.loadError
            ? <p>Attendance comparisons could not be loaded. Please try again.</p>
            : [data.attendanceTrend.weekPct, data.attendanceTrend.threeWeekPct, data.attendanceTrend.monthPct].some(value => value === null)
              && <p>Comparisons need complete daily attendance totals for each period.</p>}
        </Link>}
        {features.observations && <Link className={styles.stat} href="/observe/history">
          <span className={styles.statTitle}><span className={styles.icon}><IconClipboard/></span>Lessons observed</span><strong className={styles.value}>{data.weekObsCount}</strong><p>Last 7 days</p><div className={styles.metricFooter}>Observation history<span aria-hidden="true">↗</span></div>
        </Link>}
        <Link className={styles.stat} href={`${teaching}&view=teachers&status=LOW_COVERAGE`}>
          <span className={styles.statTitle}><span className={styles.icon}><IconUsersTwo/></span>Observation coverage</span><strong className={styles.value}>{coverage}<span className={styles.valueSuffix}> / {data.teacherRows.length}</span></strong><p>Sufficient evidence · {windowDays} days</p><div className={styles.coverageTrack} aria-hidden="true"><span style={{width:`${data.teacherRows.length ? coverage/data.teacherRows.length*100 : 0}%`}}/></div><div className={styles.metricFooter}>Teachers covered<span aria-hidden="true">↗</span></div>
        </Link>
        {features.assessments && <Link className={styles.stat} href="/insights/attainment">
          <span className={styles.statTitle}><span className={styles.icon}><IconChartBar/></span>Latest assessment</span><strong className={styles.value}>{data.attainmentSummary?.studentCount ?? "—"}</strong>
          <p>{data.attainmentSummary ? `${data.attainmentSummary.cycleLabel} · ${data.attainmentSummary.latestPointLabel ?? "No result point"}` : "No results"}{data.attainmentSummary && <><br/>Students assessed</>}</p><div className={styles.metricFooter}>Explore attainment<span aria-hidden="true">↗</span></div>
        </Link>}
      </div>
    </section>}
    <div className={styles.columns}>
      <div className={styles.focusColumn}><section className={styles.panel} aria-labelledby="briefing-attention">
        <div className={styles.head}><div><span className={styles.eyebrow}>Priorities</span><h2 id="briefing-attention">Where to focus</h2></div><span className={styles.sectionIcon}><IconClipboard/></span></div>
        {features.onCall && data.liveOnCallBanner.count > 0 && <Link className={styles.row} href="/on-call"><span className={styles.icon}><IconPhone/></span><div><h3>{data.liveOnCallBanner.count} active on-call request{data.liveOnCallBanner.count===1?"":"s"}</h3><p>{data.liveOnCallBanner.latest ? `${data.liveOnCallBanner.latest.requesterName}${data.liveOnCallBanner.latest.location ? " · "+data.liveOnCallBanner.latest.location : ""}` : "Review the live queue"}</p><small>Live queue · includes acknowledged requests</small></div><span className={styles.arrow}>→</span></Link>}
        {features.analysis && <>
          {features.students && studentsToReview.slice(0,2).map(s=><Link key={s.studentId} className={styles.row} href={`/students/${s.studentId}?window=${windowDays}&from=${from}#pastoral-evidence`}><span className={styles.avatar} aria-hidden="true">{initials(s.studentName)}</span><div><h3>{s.studentName}</h3><p>{s.drivers.length?s.drivers.slice(0,2).map(d=>reasons[d.metric]??d.label).join(" · ")+(s.drivers.length>2?` · +${s.drivers.length-2} more`:""):"Review the recorded priority indicators"}</p><small>Snapshot {date(s.lastSnapshotDate)}{s.confidence==="LOW"?" · Limited comparison evidence":""}</small></div><span className={`${styles.tag} ${s.band==="URGENT"?styles.urgent:""}`}>{s.band==="URGENT"?"Urgent":"Priority"}</span><span className={styles.arrow}>→</span></Link>)}
          {teachersToReview.slice(0,1).map(t=><Link key={t.teacherMembershipId} className={styles.row} href={`/analysis/teachers/${t.teacherMembershipId}?window=${windowDays}&from=${encodeURIComponent(teaching+"&view=teachers")}`}><span className={styles.avatar} aria-hidden="true">{initials(t.teacherName)}</span><div><h3>{t.teacherName}</h3><p>Lesson signals declining</p><small>{t.teacherCoverage} observations · Last observed {date(t.lastObservationAt)}</small></div><span className={styles.tag}>Teaching</span><span className={styles.arrow}>→</span></Link>)}
          {cpd && <Link className={styles.row} href={`${teaching}&view=cpd`}><div><h3>{cpd.label}</h3><p>{cpd.teachersDriftingDown} of {cpd.teachersCovered} teachers show a decline.</p><small>Last {windowDays} days</small></div><span className={styles.tag}>CPD</span><span className={styles.arrow}>→</span></Link>}
          {!concerns && <p className={styles.empty}>{data.teacherRows.length || data.studentRows.length ? "No priorities in the available evidence." : "Not enough evidence yet."}</p>}
          <div className={styles.footer}><Link href={`${teaching}&view=teachers`}>{teachersToReview.length} teacher{teachersToReview.length===1?"":"s"} to review →</Link>{features.students && <Link href={students}>{studentsToReview.length} students needing attention →</Link>}</div>
          <details className={styles.evidenceNote}><summary>About this evidence</summary><p>Teaching: last {windowDays} days versus the preceding {windowDays}. {features.students ? `Student snapshots: ${data.studentRows.filter(s=>s.lastSnapshotDate).length} of ${data.studentRows.length} available.` : ""}</p></details>
        </>}
        {!features.analysis && <p className={styles.empty}>Insights not enabled.</p>}
      </section>
      {features.analysis && <section className={`${styles.panel} ${styles.celebration}`} aria-labelledby="celebration-title">
        <div className={styles.head}><div><span className={styles.eyebrow}>Positive movement</span><h2 id="celebration-title">Worth celebrating</h2></div><span className={styles.positiveMark} aria-hidden="true">↗</span></div>
        {strength && <Link className={styles.row} href={`${teaching}&view=cpd`}><div><h3>{strength.label}</h3><p>Improving signals for {strength.teachersImproving} of {strength.teachersCovered} teachers covered.</p><small>School-wide pattern · last {windowDays} days</small></div><span className={styles.arrow}>→</span></Link>}
        {improvingTeachers.slice(0, 3).map(t => <Link key={t.teacherMembershipId} className={styles.row} href={`/analysis/teachers/${t.teacherMembershipId}?window=${windowDays}&from=${from}`}><div><h3>{t.teacherName}</h3><p>Improving lesson signals</p><small>{t.teacherCoverage} observations · comparable evidence in both periods</small></div><span className={styles.positiveTag}>Improving</span><span className={styles.arrow}>→</span></Link>)}
        {!strength && !improvingTeachers.length && <p className={styles.empty}>No sustained improvement is flagged yet. Positive patterns appear here when there is enough evidence to compare.</p>}
        <p className={styles.note}>A prompt to recognise progress and explore practice, based on recorded lesson signals.</p>
      </section>}
      </div>
      <section className={styles.work} aria-label="Today's work">
        <div className={styles.panel}><div className={styles.head}><div><span className={styles.eyebrow}>Your day</span><h2>Today’s work</h2></div><span className={styles.icon}><IconCalendar/></span></div>
          {features.leave && <><Link className={styles.workRow} href="/leave#pending-requests"><span className={styles.icon}><IconUmbrella/></span><span>Leave approvals</span><strong>{data.pendingLeaveCount}</strong><span className={styles.arrow}>→</span></Link>{data.pendingLeaveDetails.slice(0,2).map(l=><Link key={l.id} className={styles.row} href={`/leave/${l.id}`}><div><h3>{l.requesterName}</h3><small>{l.reasonLabel} · {date(l.startDate)}–{date(l.endDate)}</small></div><span className={styles.arrow}>→</span></Link>)}</>}
          {work && <><Link className={styles.workRow} href="/my-actions"><span className={styles.icon}><IconClipboard/></span><span>Your open actions</span><strong>{work.actionCount??"—"}</strong><span className={styles.arrow}>→</span></Link>{work.actions===null?<p className={styles.empty}>Actions unavailable</p>:work.actions.slice(0,3).map(a=><Link className={styles.row} key={a.id} href="/my-actions"><div><h3>{a.description}</h3><small>{a.dueDate?`Due ${date(a.dueDate)}`:"No due date"}{a.status==="BLOCKED"?" · Blocked":""}</small></div><span className={styles.arrow}>→</span></Link>)}
          <Link className={styles.workRow} href="/meetings"><span className={styles.icon}><IconCalendar/></span><span>Your meetings today</span><strong>{work.meetings?.length??"—"}</strong><span className={styles.arrow}>→</span></Link>{work.meetings===null?<p className={styles.empty}>Meetings unavailable</p>:work.meetings.slice(0,3).map(m=><Link key={m.id} href={`/meetings/${m.id}`} className={styles.row}><div><h3>{m.title}</h3><small>{m.startDateTime.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"})}{m.location?` · ${m.location}`:""}</small></div><span className={styles.arrow}>→</span></Link>)}</>}
          {features.students && <Link className={styles.workRow} href={`${students}&view=watchlist`}><span className={styles.icon}><IconUsersTwo/></span><span>Your student watchlist</span><strong>{data.watchlistStudents.length}</strong><span className={styles.arrow}>→</span></Link>}
          {!work && !features.leave && !features.students && <p className={styles.empty}>No work queues enabled.</p>}
        </div>
      </section>
    </div>
    {features.analysis && <section aria-labelledby="continue-investigating"><div className={styles.head}><div><h2 id="continue-investigating">Explore your school</h2></div><Link href={`/insights?windowDays=${windowDays}`}>All insights →</Link></div><nav className={styles.areas} aria-label="Explore Insights">
      <Link className={styles.area} href={teaching}><span className={styles.icon}><IconClipboard/></span><div><h3>Teaching</h3><p>Lesson patterns & CPD</p></div><span className={styles.arrow}>→</span></Link>
      {features.students && <Link className={styles.area} href={students}><span className={styles.icon}><IconUsersTwo/></span><div><h3>Students</h3><p>Attendance & behaviour</p></div><span className={styles.arrow}>→</span></Link>}
      {features.assessments && <Link className={styles.area} href="/insights/attainment"><span className={styles.icon}><IconChartBar/></span><div><h3>Attainment</h3><p>Subjects & groups</p></div><span className={styles.arrow}>→</span></Link>}
    </nav></section>}
  </div>;
}
