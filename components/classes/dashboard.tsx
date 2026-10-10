"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClassDetail } from "./detail";
import type { ClassData } from "@/modules/classes/data";
import type { ClassLabels } from "@/modules/classes/presentation";
export function ClassDashboard({ data, classes, windowDays, labels }: { data: ClassData; classes: { id: string; name: string; subject: string }[]; windowDays: number; labels: ClassLabels }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="class-dashboard space-y-5" aria-busy={pending}>
    <section className="class-identity">
      <div className="class-identity-main"><div className="class-monogram" aria-hidden="true">{data.name.length < 5 ? data.name : data.yearGroup.replace("Y", "")}</div><div className="min-w-0"><p className="class-kicker">CLASS OVERVIEW</p><h2 className="class-name">{data.name}</h2><p className="mt-1 text-sm text-muted">{data.subject} <span className="mx-2 opacity-40">/</span> {data.count} pupils <span className="mx-2 opacity-40">/</span> {data.teachers.length} teachers</p></div></div>
      <div className="class-field class-switcher"><label htmlFor="selected-class">Switch class</label><select className="field" id="selected-class" value={data.id} disabled={pending} onChange={e => { const id = e.target.value; startTransition(() => router.push(`/classes?class=${id}`)); }}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.subject === "All subjects" ? "" : ` · ${c.subject}`}</option>)}</select></div>
      <details className="class-teaching"><summary><span className="class-avatar-stack" aria-hidden="true">{data.teachers.slice(0,4).map(t => <span key={t.id}>{t.name.split(" ").map(n => n[0]).slice(0,2).join("")}</span>)}</span><span><strong>Teaching team</strong><span className="block text-xs text-muted">{data.teachers.slice(0,2).map(t=>t.name).join(", ")}{data.teachers.length > 2 ? ` + ${data.teachers.length - 2} more` : ""}</span></span><span className="ml-auto text-xs text-muted">View teachers ↓</span></summary><div className="flex flex-wrap gap-2 pt-4">{data.teachers.map(t => <span className="class-badge" key={t.id}>{t.name}</span>)}</div></details>
    </section>
    <ClassDetail key={data.id} data={data} windowDays={windowDays} labels={labels} />
  </div>;
}
