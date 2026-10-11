import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { buildViewerContext } from "@/lib/viewerContext";
import { canViewExplorer, canViewBehaviourExplorer, canViewStudentAnalysis } from "@/modules/authz";
import { computeStudentRiskIndex } from "@/modules/analysis/studentRisk";
import { filterStudentRows, parseSortMode, BAND_LABELS } from "@/modules/students/explorerList";
import { formatYearGroup } from "@/modules/observations/yearGroup";
import { getTenantVocab } from "@/lib/vocab";
import { PageHeader } from "@/components/ui/page-header";
import { WatchlistToggle } from "../../explorer/students/WatchlistToggle";
import { InvestigationScroll } from "./scroll";
import styles from "./page.module.css";

export default async function StudentInsights({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => { const v = params[key]; return (Array.isArray(v) ? v[0] : v) ?? ""; };
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");
  const viewer = await buildViewerContext(user);
  if (!canViewExplorer(viewer) || !canViewBehaviourExplorer(viewer) || !canViewStudentAnalysis(viewer)) notFound();
  const vocab = await getTenantVocab(user.tenantId);
  const reasons: Record<string,string> = { attendance: "Attendance has fallen", detentions: vocab.detentions.plural + " have increased", onCalls: vocab.on_calls.plural + " have increased", suspensions: vocab.suspensions.plural + " have increased", internalExclusions: vocab.internal_exclusions.plural + " have increased", lateness: "Lateness has increased" };
  const windowDays = [7,21,28].includes(Number(value("windowDays"))) ? Number(value("windowDays")) : 21;
  const view = ["all","watchlist"].includes(value("view")) ? value("view") : "attention";
  const sort = parseSortMode(value("sort"));
  const { rows: allRows } = await computeStudentRiskIndex(user.tenantId, windowDays, user.id, "ACTIVE");
  const rows = filterStudentRows(allRows, {
    view: view === "attention" ? "attention" : "all", band: value("band"),
    yearGroup: value("yearGroup"), studentSearch: value("q"), send: value("send"),
    pp: value("pp"), confidence: value("confidence"), watchlistOnly: view === "watchlist",
    attendanceBelow80: value("attendanceBelow") === "1", sort,
  });
  const query = new URLSearchParams();
  for (const key of ["view","windowDays","sort","yearGroup","q","send","pp","confidence","attendanceBelow","band"]) {
    if (value(key)) query.set(key,value(key));
  }
  const totalPages = Math.max(1,Math.ceil(rows.length/25));
  const page = Math.min(totalPages,Math.max(1,Number.parseInt(value("page"),10)||1));
  query.set("page",String(page));
  const returnPath = "/insights/students?" + query.toString();
  const href = (changes: Record<string,string>) => {
    const next = new URLSearchParams(query); next.delete("page");
    for (const [key,v] of Object.entries(changes)) v ? next.set(key,v) : next.delete(key);
    return "/insights/students?" + next.toString();
  };
  const priorityCount = allRows.filter(r=>r.band==="URGENT"||r.band==="PRIORITY").length;
  const missing = allRows.filter(r=>!r.lastSnapshotDate).length;
  const years = [...new Set(allRows.map(r=>r.yearGroup).filter((y): y is string => Boolean(y)))].sort();
  return <div className={styles.page}>
    <InvestigationScroll />
    <Link className={styles.back} href={`/insights?windowDays=${windowDays}`}>← Insights</Link>
    <PageHeader variant="ledger" title="Student insights" subtitle="Understand who needs attention, review the evidence and decide what to do next." />
    <div className={styles.summary}>
      <div><span>Needs attention</span><strong>{priorityCount}</strong><p>Students in the priority or urgent bands</p></div>
      <div><span>My watchlist</span><strong>{allRows.filter(r=>r.onWatchlist).length}</strong><p>Students you have chosen to follow</p></div>
      <div><span>Evidence available</span><strong>{allRows.length-missing} / {allRows.length}</strong><p>Active students with a snapshot</p></div>
    </div>
    <section aria-label="Find students" className={styles.filters}>
      <nav aria-label="Student insight views" className={styles.tabs}>
        {[["attention","Needs attention"],["all","All students"],["watchlist","My watchlist"]].map(([key,label])=>
          <Link key={key} href={href({view:key,band:""})} aria-current={view===key?"page":undefined}>{label}</Link>)}
      </nav>
      <form action="/insights/students">
        <input type="hidden" name="view" value={view} />
        <div className={styles.fields}>
          <label>Student name<input name="q" type="search" defaultValue={value("q")} placeholder="Find a student…" /></label>
          <label>Year group<select name="yearGroup" defaultValue={value("yearGroup")}><option value="">All year groups</option>{years.map(y=><option key={y} value={y}>{formatYearGroup(y)}</option>)}</select></label>
          <label>Comparison period<select name="windowDays" defaultValue={windowDays}>{[7,21,28].map(w=><option key={w} value={w}>{w} days</option>)}</select></label>
          <label>Sort by<select name="sort" defaultValue={sort}><option value="risk">Priority first</option><option value="name">Name A–Z</option><option value="attendance_asc">Lowest attendance</option><option value="attendance_desc">Highest attendance</option></select></label>
        </div>
        <details className={styles.advanced} open={Boolean(value("send")||value("pp")||value("confidence")||value("attendanceBelow")||value("band"))}>
          <summary>More filters</summary><div className={styles.fields}>
            <label>SEND<select name="send" defaultValue={value("send")}><option value="">All students</option><option value="true">SEND</option><option value="false">No SEND recorded</option></select></label>
            <label>Pupil premium<select name="pp" defaultValue={value("pp")}><option value="">All students</option><option value="true">Pupil premium</option><option value="false">Not pupil premium</option></select></label>
            <label>Comparison evidence<select name="confidence" defaultValue={value("confidence")}><option value="">All evidence</option><option value="HIGH">Previous snapshot available</option><option value="LOW">Limited comparison evidence</option></select></label>
            <label>Priority band<select name="band" defaultValue={value("band")}><option value="">All bands in this view</option>{Object.entries(BAND_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
            <label className={styles.check}><input type="checkbox" name="attendanceBelow" value="1" defaultChecked={value("attendanceBelow")==="1"} />Attendance below 80%</label>
          </div>
        </details>
        <div className={styles.actions}><button type="submit">Apply filters</button><Link href={href({q:"",yearGroup:"",send:"",pp:"",confidence:"",attendanceBelow:"",band:"",sort:""})}>Clear filters</Link></div>
      </form>
    </section>
    <div className={styles.heading}><h2>{view==="attention"?"Students needing attention":view==="watchlist"?"Your watchlist":"All active students"}</h2><span>{rows.length} students</span></div>
    <p className={styles.note}>Attendance and behaviour use the latest available snapshots. Changes compare snapshots across the selected {windowDays}-day periods; they are not incident totals for that period. Open a profile to review the full evidence.</p>
    <div className={styles.list}>
      {!rows.length && <div className={styles.empty}><h3>No students in this view</h3><p>{allRows.length?"Try All students or adjust the filters.":"No active student snapshots are available yet."}</p><Link href={href({view:"all",q:"",yearGroup:"",band:"",send:"",pp:"",confidence:"",attendanceBelow:""})}>View all students</Link></div>}
      {rows.slice((page-1)*25,page*25).map(row=><article key={row.studentId} className={styles.row}>
        <div className={styles.person}><span className={styles.avatar} aria-hidden="true">{row.studentName.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><div><Link data-student-profile href={`/students/${row.studentId}?window=${windowDays}&from=${encodeURIComponent(returnPath)}#pastoral-evidence`}>{row.studentName}</Link><p>{formatYearGroup(row.yearGroup)} · {BAND_LABELS[row.band]}</p></div></div>
        <div className={styles.evidence}><p>{row.drivers.length?row.drivers.map(d=>reasons[d.metric] ?? d.label).join(" · "):row.lastSnapshotDate?"No priority indicators recorded":"No snapshot available"}</p><span>{row.lastSnapshotDate?"Snapshot "+new Date(row.lastSnapshotDate).toLocaleDateString("en-GB"):"Evidence missing"}{row.confidence==="LOW"?" · Limited comparison evidence":""}</span></div>
        <div className={styles.attendance}><span>Attendance</span><strong>{row.attendancePct===null?"—":row.attendancePct.toFixed(1)+"%"}</strong></div>
        <WatchlistToggle studentId={row.studentId} initialOnWatchlist={row.onWatchlist} />
      </article>)}
    </div>
    <details className={styles.advanced}><summary>Group patterns and detailed evidence</summary><div className={styles.actions}><Link href={`/insights/students/groups?windowDays=${windowDays}`}>Year-group patterns →</Link><Link href={`/insights/students/patterns?windowDays=${windowDays}`}>Attendance and behaviour patterns →</Link><Link href="/students">Student directory and exports →</Link></div></details>
    <nav className={styles.pagination} aria-label="Student pages">{page>1&&<Link href={href({page:String(page-1)})}>← Previous</Link>}<span>Page {page} of {totalPages}</span>{page<totalPages&&<Link href={href({page:String(page+1)})}>Next →</Link>}</nav>
  </div>;
}
