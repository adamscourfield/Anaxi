import { getSessionUserOrThrow } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ClassDashboard } from "@/components/classes/dashboard";
import { loadClasses } from "@/modules/classes/data";

import "./classes.css";

export const metadata = { title: "Classes | Anaxi" };
export const dynamic = "force-dynamic";
function classWindow(value: string | string[] | undefined) { const number = Number(value); return [7, 14, 21, 28].includes(number) ? number : 21; }
export default async function ClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUserOrThrow();
  const params = await searchParams;
  const windowDays = classWindow(params.window);
  const data = await loadClasses(user.tenantId, windowDays);
  const selected = data.classes.find(c => c.id === params.class) ?? data.classes.find(c => c.teachers.some(t => t.id === user.id)) ?? data.classes[0];
  return <div className="class-enter space-y-6">
    <PageHeader title="Classes" eyebrow="Students" subtitle="Your class, its teachers and every pupil’s outcomes in one place." />
    {selected ? <ClassDashboard key={selected.id} data={selected} classes={data.classes.map(c => ({ id: c.id, name: c.name, subject: c.subject }))} windowDays={windowDays} /> : <p className="class-panel p-8 text-muted">No current classes have been imported yet.</p>}
  </div>;
}
