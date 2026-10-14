import Link from "next/link";
import { NATIONAL_ATTENDANCE_BENCHMARK_PCT, type hydrateLeadershipHomeData } from "@/modules/home/hydration";
import type { fetchLeaderWork } from "@/modules/home/leaderWork";
import { buildLeaderSummary, type SummaryTone } from "@/modules/home/leaderSummary";
import { InsightWindowSelector } from "./InsightWindowSelector";
import { IconUsersTwo, IconChartBar, IconClipboard, IconUmbrella, IconPhone, IconCalendar, IconSparkles, IconStar, IconTrendUp } from "./home-chrome";
import styles from "./LeaderBriefing.module.css";

type Props = {
  data: Awaited<ReturnType<typeof hydrateLeadershipHomeData>>;
  work: Awaited<ReturnType<typeof fetchLeaderWork>>;
  windowDays: number;
  features: { analysis: boolean; students: boolean; assessments: boolean; leave: boolean; onCall: boolean; observations: boolean };
  reasons: Record<string, string>;
};
const date = (value: Date | string | null) => value ? new Date(value).toLocaleDateString("en-GB", { day:"numeric", month:"short", timeZone:"Europe/London" }) : "not available";
const toneClass: Record<SummaryTone, string> = { positive: styles.tonePositive, negative: styles.toneNegative, watch: styles.toneWatch, neutral: styles.toneNeutral };
function DeltaChip({label, delta}: {label: string; delta: number | null}) {
  if (delta === null) return null;
  const rounded = Math.round(delta * 10) / 10;
  const tone = rounded >= 0.5 ? styles.chipPositive : rounded <= -0.5 ? styles.chipNegative : styles.chipNeutral;
  return <span className={`${styles.chip} ${tone}`}>{label} {rounded > 0 ? "+" : ""}{rounded.toFixed(1)}pts</span>;
}

export function LeaderBriefing({data,work,windowDays,features,reasons}: Props) {
  const teaching = `/insights/teaching?windowDays=${windowDays}`;
  const students = `/insights/students?windowDays=${windowDays}`;
  const teachersToReview = data.teacherRows.filter(t=>t.status === "SIGNIFICANT_DRIFT" || t.status === "EMERGING_DRIFT");
  const teachersToCelebrate = data.teacherRows.filter(t=>t.momentumStatus === "STRONG_IMPROVEMENT" || t.momentumStatus === "EMERGING_IMPROVEMENT")
    .sort((a,b)=>b.normalizedPositiveIDS-a.normalizedPositiveIDS);
  const studentsToReview = data.studentRows.filter(s=>s.band === "URGENT" || s.band === "PRIORITY")
    .sort((a,b)=>(a.band === "URGENT" ? 0:1)-(b.band === "URGENT" ? 0:1)||b.riskScore-a.riskScore);
  const cpd = data.cpdRows.find(s=>s.teachersDriftingDown>0);
  const coverage = data.teacherRows.filter(t=>t.status!=="LOW_COVERAGE").length;
  const from = encodeURIComponent(`/home?window=${windowDays}`);
  const concerns = studentsToReview.length+teachersToReview.length+(cpd?1:0);
  const summary = features.analysis ? buildLeaderSummary({
    attendanceHeadline: data.attendanceHeadline,
    attendanceTrend: data.attendanceTrend,
    studentRows: features.students ? data.studentRows : [],
    teacherRows: data.teacherRows,
    cpdRows: data.cpdRows,
    topImproving: data.topImproving,
  }) : null;
  return <div className={styles.briefing}>
    {summary && <section aria-labelledby="week-briefing" className={styles.narrative}>
      <div className={styles.head}><div><h2 id="week-briefing">This week, at a glance</h2><p>Auto-generated from live school data · not written by AI</p></div></div>
      <p className={`${styles.narrativeHeadline} ${toneClass[summary.headlineTone]}`}>{summary.headline}</p>
      {summary.lines.length > 0 && <ul className={styles.narrativeLines}>
        {summary.lines.map(l=><li key={l.id} className={toneClass[l.tone]}>{l.text}</li>)}
      </ul>}
    </section>}
    {features.analysis && <section aria-labelledby="school-snapshot">
      <div className={styles.head}><h2 id="school-snapshot">School snapshot</h2></div>
      <div className={styles.snapshot}>
        {features.students && <Link className={styles.stat} href={`${students}&view=all&sort=attendance_asc`}>
          <span className={styles.statTitle}><span className={styles.icon}><IconUsersTwo/></span>Attendance</span>
          <strong className={styles.value}>{data.attendanceHeadline.attendancePct === null ? "—" : `${data.attendanceHeadline.attendancePct.toFixed(1)}%`}</strong>
          <p>{data.attendanceHeadline.asOf ? <>Academic year to date · {data.attendanceHeadline.studentsCovered} students<br/>Updated {date(data.attendanceHeadline.asOf)}</> : "No snapshot"}</p>
          {data.attendanceHeadline.attendancePct !== null && <div className={styles.deltaRow}>
            <DeltaChip label="vs national avg" delta={data.attendanceHeadline.attendancePct - NATIONAL_ATTENDANCE_BENCHMARK_PCT}/>
            <DeltaChip label="vs last week" delta={data.attendanceTrend.last7DaysPct !== null && data.attendanceTrend.prior7DaysPct !== null ? data.attendanceTrend.last7DaysPct - data.attendanceTrend.prior7DaysPct : null}/>
            <DeltaChip label="vs last month" delta={data.attendanceTrend.last28DaysPct !== null && data.attendanceTrend.prior28DaysPct !== null ? data.attendanceTrend.last28DaysPct - data.attendanceTrend.prior28DaysPct : null}/>
          </div>}
        </Link>}
        {features.observations && <Link className={styles.stat} href="/observe/history">
          <span className={styles.statTitle}><span className={styles.icon}><IconClipboard/></span>Lessons observed</span><strong className={styles.value}>{data.weekObsCount}</strong><p>Last 7 days</p>
        </Link>}
        <Link className={styles.stat} href={`${teaching}&view=teachers&status=LOW_COVERAGE`}>
          <span className={styles.statTitle}><span className={styles.icon}><IconUsersTwo/></span>Observation coverage</span><strong className={styles.value}>{coverage}<span className="text-sm font-normal text-muted"> / {data.teacherRows.length}</span></strong><p>Sufficient evidence · {windowDays} days</p>
        </Link>
        {features.assessments && <Link className={styles.stat} href="/insights/attainment">
          <span className={styles.statTitle}><span className={styles.icon}><IconChartBar/></span>Latest assessment</span><strong className={styles.value}>{data.attainmentSummary?.studentCount ?? "—"}</strong>
          <p>{data.attainmentSummary ? `${data.attainmentSummary.cycleLabel} · ${data.attainmentSummary.latestPointLabel ?? "No result point"}` : "No results"}{data.attainmentSummary && <><br/>Students assessed</>}</p>
        </Link>}
      </div>
    </section>}
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="briefing-attention">
        <div className={styles.head}><div><h2 id="briefing-attention">Needs attention</h2></div></div>
        {features.onCall && data.liveOnCallBanner.count > 0 && <Link className={styles.row} href="/on-call"><span className={styles.icon}><IconPhone/></span><div><h3>{data.liveOnCallBanner.count} active on-call request{data.liveOnCallBanner.count===1?"":"s"}</h3><p>{data.liveOnCallBanner.latest ? `${data.liveOnCallBanner.latest.requesterName}${data.liveOnCallBanner.latest.location ? " · "+data.liveOnCallBanner.latest.location : ""}` : "Review the live queue"}</p><small>Live queue · includes acknowledged requests</small></div><span className={styles.arrow}>→</span></Link>}
        {features.analysis && <><div className={styles.head}><div className={styles.period}><span>Evidence period</span><InsightWindowSelector windowDays={windowDays} options={[7,21,28]}/></div></div>
          {features.students && studentsToReview.slice(0,2).map(s=><Link key={s.studentId} className={styles.row} href={`/students/${s.studentId}?window=${windowDays}&from=${from}#pastoral-evidence`}><div><h3>{s.studentName}</h3><p>{s.drivers.length?s.drivers.slice(0,2).map(d=>reasons[d.metric]??d.label).join(" · ")+(s.drivers.length>2?` · +${s.drivers.length-2} more`:""):"Review the recorded priority indicators"}</p><small>Snapshot {date(s.lastSnapshotDate)}{s.confidence==="LOW"?" · Limited comparison evidence":""}</small></div><span className={`${styles.tag} ${s.band==="URGENT"?styles.urgent:""}`}>{s.band==="URGENT"?"Urgent":"Priority"}</span><span className={styles.arrow}>→</span></Link>)}
          {teachersToReview.slice(0,1).map(t=><Link key={t.teacherMembershipId} className={styles.row} href={`/analysis/teachers/${t.teacherMembershipId}?window=${windowDays}&from=${encodeURIComponent(teaching+"&view=teachers")}`}><div><h3>{t.teacherName}</h3><p>Lesson signals declining</p><small>{t.teacherCoverage} observations · Last observed {date(t.lastObservationAt)}</small></div><span className={styles.tag}>Teaching</span><span className={styles.arrow}>→</span></Link>)}
          {cpd && <Link className={styles.row} href={`${teaching}&view=cpd`}><div><h3>{cpd.label}</h3><p>{cpd.teachersDriftingDown} of {cpd.teachersCovered} teachers show a decline.</p><small>Last {windowDays} days</small></div><span className={styles.tag}>CPD</span><span className={styles.arrow}>→</span></Link>}
          {!concerns && <p className={styles.empty}>{data.teacherRows.length || data.studentRows.length ? "No priorities in the available evidence." : "Not enough evidence yet."}</p>}
          <div className={styles.footer}><Link href={`${teaching}&view=teachers`}>{teachersToReview.length} teacher{teachersToReview.length===1?"":"s"} to review →</Link>{features.students && <Link href={students}>{studentsToReview.length} students needing attention →</Link>}</div>
          <details className={styles.evidenceNote}><summary>About this evidence</summary><p>Teaching: last {windowDays} days versus the preceding {windowDays}. {features.students ? `Student snapshots: ${data.studentRows.filter(s=>s.lastSnapshotDate).length} of ${data.studentRows.length} available.` : ""}</p></details>
        </>}
        {!features.analysis && <p className={styles.empty}>Insights not enabled.</p>}
      </section>
      <section className={styles.work} aria-label="Today's work">
        <div className={styles.panel}><div className={styles.head}><h2>Today’s work</h2></div>
          {features.leave && <><Link className={styles.workRow} href="/leave#pending-requests"><span className={styles.icon}><IconUmbrella/></span><span>Leave approvals</span><strong>{data.pendingLeaveCount}</strong><span className={styles.arrow}>→</span></Link>{data.pendingLeaveDetails.slice(0,2).map(l=><Link key={l.id} className={styles.row} href={`/leave/${l.id}`}><div><h3>{l.requesterName}</h3><small>{l.reasonLabel} · {date(l.startDate)}–{date(l.endDate)}</small></div><span className={styles.arrow}>→</span></Link>)}</>}
          {work && <><Link className={styles.workRow} href="/my-actions"><span className={styles.icon}><IconClipboard/></span><span>Your open actions</span><strong>{work.actionCount??"—"}</strong><span className={styles.arrow}>→</span></Link>{work.actions===null?<p className={styles.empty}>Actions unavailable</p>:work.actions.slice(0,3).map(a=><Link className={styles.row} key={a.id} href="/my-actions"><div><h3>{a.description}</h3><small>{a.dueDate?`Due ${date(a.dueDate)}`:"No due date"}{a.status==="BLOCKED"?" · Blocked":""}</small></div><span className={styles.arrow}>→</span></Link>)}
          <Link className={styles.workRow} href="/meetings"><span className={styles.icon}><IconCalendar/></span><span>Your meetings today</span><strong>{work.meetings?.length??"—"}</strong><span className={styles.arrow}>→</span></Link>{work.meetings===null?<p className={styles.empty}>Meetings unavailable</p>:work.meetings.slice(0,3).map(m=><Link key={m.id} href={`/meetings/${m.id}`} className={styles.row}><div><h3>{m.title}</h3><small>{m.startDateTime.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"})}{m.location?` · ${m.location}`:""}</small></div><span className={styles.arrow}>→</span></Link>)}</>}
          {features.students && <Link className={styles.workRow} href={`${students}&view=watchlist`}><span className={styles.icon}><IconUsersTwo/></span><span>Your student watchlist</span><strong>{data.watchlistStudents.length}</strong><span className={styles.arrow}>→</span></Link>}
          {!work && !features.leave && !features.students && <p className={styles.empty}>No work queues enabled.</p>}
        </div>
      </section>
    </div>
    {features.analysis && (teachersToCelebrate.length > 0 || data.topImproving.length > 0) && <section className={styles.panel} aria-labelledby="worth-celebrating">
      <div className={styles.head}><div><h2 id="worth-celebrating"><span className={styles.celebrateIcon}><IconSparkles/></span>Worth celebrating</h2></div></div>
      {data.topImproving.slice(0,1).map(s=><Link key={s.signalKey} className={styles.row} href={`${teaching}&view=cpd`}><span className={styles.icon}><IconTrendUp/></span><div><h3>{s.label}</h3><p>{s.teachersImproving} of {s.teachersCovered} teachers are improving.</p><small>Last {windowDays} days</small></div><span className={`${styles.tag} ${styles.positive}`}>Signal</span><span className={styles.arrow}>→</span></Link>)}
      {teachersToCelebrate.slice(0,3).map(t=><Link key={t.teacherMembershipId} className={styles.row} href={`/analysis/teachers/${t.teacherMembershipId}?window=${windowDays}&from=${encodeURIComponent(teaching+"&view=teachers")}`}><span className={styles.icon}><IconStar/></span><div><h3>{t.teacherName}</h3><p>Lesson signals trending up</p><small>{t.teacherCoverage} observations · Last observed {date(t.lastObservationAt)}</small></div><span className={`${styles.tag} ${styles.positive}`}>Teaching</span><span className={styles.arrow}>→</span></Link>)}
    </section>}
    {features.analysis && <section aria-labelledby="continue-investigating"><div className={styles.head}><div><h2 id="continue-investigating">Insights</h2></div><Link href={`/insights?windowDays=${windowDays}`}>All insights →</Link></div><nav className={styles.areas} aria-label="Explore Insights">
      <Link className={styles.area} href={teaching}><span className={styles.icon}><IconClipboard/></span><div><h3>Teaching</h3><p>Lesson patterns & CPD</p></div><span className={styles.arrow}>→</span></Link>
      {features.students && <Link className={styles.area} href={students}><span className={styles.icon}><IconUsersTwo/></span><div><h3>Students</h3><p>Attendance & behaviour</p></div><span className={styles.arrow}>→</span></Link>}
      {features.assessments && <Link className={styles.area} href="/insights/attainment"><span className={styles.icon}><IconChartBar/></span><div><h3>Attainment</h3><p>Subjects & groups</p></div><span className={styles.arrow}>→</span></Link>}
    </nav></section>}
  </div>;
}
