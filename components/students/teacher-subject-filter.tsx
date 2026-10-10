"use client";

import { useEffect, useId, useState } from "react";

type TeacherSubjectFilterProps = {
  subjects: string[];
};

/** Filters the already-authorized teacher roster without another page request. */
export function TeacherSubjectFilter({ subjects }: TeacherSubjectFilterProps) {
  const [subject, setSubject] = useState("");
  const selectId = useId();

  useEffect(() => {
    const rows = document.querySelectorAll<HTMLElement>("#teacher-assignment-list [data-teacher-subjects]");
    let visible = 0;
    rows.forEach((row) => {
      const rowSubjects = JSON.parse(row.dataset.teacherSubjects ?? "[]") as string[];
      const matches = !subject || rowSubjects.includes(subject);
      row.hidden = !matches;
      if (matches) visible += 1;
    });
    document.getElementById("teacher-subject-filter-empty")?.toggleAttribute("hidden", visible > 0);
  }, [subject]);

  if (subjects.length < 2) return null;

  return (
    <div className="mb-5 flex items-center gap-3">
      <label htmlFor={selectId} className="shrink-0 text-xs font-semibold text-muted">Subject</label>
      <select
        id={selectId}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        className="min-w-0 flex-1 rounded-md border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
      >
        <option value="">All subjects</option>
        {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  );
}
