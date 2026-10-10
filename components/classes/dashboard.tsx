"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClassDetail } from "./detail";
import type { ClassData } from "@/modules/classes/data";
export function ClassDashboard({ data, classes, windowDays }: { data: ClassData; classes: { id: string; name: string; subject: string }[]; windowDays: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <><section className="class-panel flex flex-wrap items-end justify-between gap-5 p-5 sm:p-6"><div className="class-field w-full sm:max-w-lg"><label htmlFor="selected-class">Current class</label><select className="field" id="selected-class" value={data.id} disabled={pending} aria-busy={pending} onChange={e => { const id = e.target.value; startTransition(() => router.push(`/classes?class=${id}`)); }}>{classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}</select></div><div><p className="mb-2 text-xs text-muted">Class teachers</p><div className="flex flex-wrap gap-2">{data.teachers.map(t => <span className="class-badge" key={t.id}>{t.name}</span>)}</div></div></section><ClassDetail key={data.id} data={data} windowDays={windowDays} /></>;
}
