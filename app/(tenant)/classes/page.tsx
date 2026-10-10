import { getSessionUserOrThrow } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ClassesDirectory } from "@/components/classes/directory";
import { loadClasses } from "@/modules/classes/data";
import Link from "next/link";
import "./classes.css";

export const metadata = { title: "Classes | Anaxi" };
export const dynamic = "force-dynamic";
function classWindow(value: string | string[] | undefined) { const number = Number(value); return [7, 14, 21, 28].includes(number) ? number : 21; }
export default async function ClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUserOrThrow();
  const params = await searchParams;
  const windowDays = classWindow(params.window);
  const data = await loadClasses(user.tenantId, windowDays);
  const summaries = data.classes.map(({ students: _students, points: _points, ...summary }) => summary);
  return <div className="class-enter space-y-6">
    <PageHeader title="Classes" eyebrow="Students" subtitle="A shared view of your school’s current teaching groups, their teachers and pupil outcomes." actions={<nav className="segmented-toggle" aria-label="Behaviour event window">{[7, 14, 21, 28].map(days => <Link key={days} href={`/classes?window=${days}`} aria-current={windowDays === days ? "page" : undefined} className={`segmented-toggle-btn ${windowDays === days ? "segmented-toggle-btn-active" : ""}`}>{days}d</Link>)}</nav>} />
    <p className="text-xs leading-relaxed text-muted">Current class lists · Latest overall pupil attendance · Behaviour events over {windowDays} days · Latest subject assessment coverage</p>
    <ClassesDirectory classes={summaries} pupilCount={data.pupilCount} windowDays={windowDays} />
  </div>;
}
