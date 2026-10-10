"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";

export type TeacherAssignment = {
  teacherId: string;
  fullName: string;
  email: string | null;
  subjects: string[];
  classes: string[];
  profileHref: string | null;
};

const DOTS = ["bg-[#6366f1]", "bg-[#059669]", "bg-[#2563eb]", "bg-[#d97706]"] as const;

function dotFor(teacherId: string): string {
  let hash = 0;
  for (let i = 0; i < teacherId.length; i++) hash = (hash * 31 + teacherId.charCodeAt(i)) >>> 0;
  return DOTS[hash % DOTS.length];
}

export function TeacherAssignmentList({ teachers }: { teachers: TeacherAssignment[] }) {
  const [subject, setSubject] = useState("");
  const subjects = [...new Set(teachers.flatMap((teacher) => teacher.subjects))].sort((a, b) => a.localeCompare(b));
  const visibleTeachers = subject ? teachers.filter((teacher) => teacher.subjects.includes(subject)) : teachers;

  if (teachers.length === 0) {
    return <p className="rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] bg-[var(--surface-container-low)]/40 px-6 py-14 text-center text-sm text-muted">No subject teachers linked.</p>;
  }

  return (
    <>
      {subjects.length > 1 ? (
        <div className="mb-5 flex items-center gap-3">
          <label htmlFor="teacher-subject" className="shrink-0 text-xs font-semibold text-muted">Subject</label>
          <select id="teacher-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="min-w-0 flex-1 rounded-md border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]">
            <option value="">All subjects</option>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 divide-y divide-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] overflow-y-auto rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] bg-[var(--surface-container-lowest)]">
        {visibleTeachers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No teacher is linked to this subject.</p>
        ) : visibleTeachers.map((teacher) => {
          const rowClass = "flex items-center gap-4 px-4 py-4 calm-transition hover:bg-[color-mix(in_srgb,var(--surface-container-low)_55%,transparent)] sm:px-5";
          const subjectLine = teacher.classes.length ? teacher.classes.join(", ") : teacher.subjects.join(", ");
          const content = <>
            <Avatar name={teacher.fullName} userId={teacher.teacherId} size="xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-[-0.01em] text-text">{teacher.fullName}</p>
              <p className="mt-1 flex items-start gap-2 text-xs leading-snug text-muted"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotFor(teacher.teacherId)}`} aria-hidden /><span>{subjectLine}</span></p>
              {teacher.email ? <p className="mt-1 truncate text-xs text-muted">{teacher.email}</p> : null}
            </div>
          </>;
          return teacher.profileHref ? <Link key={teacher.teacherId} href={teacher.profileHref} className={rowClass}>{content}</Link> : <div key={teacher.teacherId} className={rowClass}>{content}</div>;
        })}
      </div>
    </>
  );
}
