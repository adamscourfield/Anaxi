import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ClassDashboard } from "@/components/classes/dashboard";
import { loadClasses } from "@/modules/classes/data";
import "../classes.css";
export const metadata = { title: "Class overview | Anaxi" };
export const dynamic = "force-dynamic";
export default async function ClassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUserOrThrow();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requested = Number(query.window);
  const windowDays = [7, 14, 21, 28].includes(requested) ? requested : 21;
  const { classes } = await loadClasses(user.tenantId, windowDays);
  const data = classes.find(group => group.id === id);
  if (!data) notFound();
  return <div className="class-enter space-y-6">
    <Link className="class-link inline-flex items-center gap-2 text-sm text-muted" href={`/classes?window=${windowDays}`}>← All classes</Link>
    <PageHeader title={data.name} eyebrow={`${data.yearGroup} · ${data.subject}`} subtitle="Attendance, behaviour and attainment for the current class roster." meta={<><span className="class-badge">{data.count} pupils</span><span className="class-badge">{data.teachers.length} {data.teachers.length === 1 ? "teacher" : "teachers"}</span></>} actions={<nav className="segmented-toggle" aria-label="Behaviour event window">{[7, 14, 21, 28].map(days => <Link key={days} href={`/classes/${id}?window=${days}`} aria-current={windowDays === days ? "page" : undefined} className={`segmented-toggle-btn ${windowDays === days ? "segmented-toggle-btn-active" : ""}`}>{days}d</Link>)}</nav>} />
    <ClassDashboard data={data} classes={classes.map(c => ({ id: c.id, name: c.name, subject: c.subject }))} windowDays={windowDays} />
  </div>;
}
