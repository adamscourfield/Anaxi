"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClassSummary } from "@/modules/classes/data";
import { formatYearGroups } from "@/modules/classes/presentation";

type DirectoryClass = Pick<ClassSummary, "id" | "name" | "subject" | "yearGroup" | "teachers" | "count" | "attendance">;

/** Every current class, searchable, with the viewer's own classes first. */
export function ClassesDirectory({ classes, myClassIds }: { classes: DirectoryClass[]; myClassIds: string[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [subject, setSubject] = useState("");

  const years = useMemo(
    () => [...new Set(classes.map((c) => c.yearGroup))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [classes],
  );
  const subjects = useMemo(() => [...new Set(classes.map((c) => c.subject))].sort(), [classes]);
  const mine = classes.filter((c) => myClassIds.includes(c.id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter(
      (c) =>
        (!year || c.yearGroup === year) &&
        (!subject || c.subject === subject) &&
        (!q || `${c.name} ${c.subject} ${c.teachers.map((t) => t.name).join(" ")}`.toLowerCase().includes(q)),
    );
  }, [classes, year, subject, search]);
  const filtersActive = Boolean(search || year || subject);

  if (!classes.length) {
    return (
      <div className="class-card px-8 py-16 text-center">
        <h2 className="text-[17px] font-semibold">No classes yet</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6e6e73]">
          Classes appear once your MIS sync or timetable import gives pupils a class name and a teacher.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {mine.length ? (
        <section aria-labelledby="my-classes-heading">
          <h2 id="my-classes-heading" className="class-section-title">
            Your classes
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {mine.map((c) => (
              <li key={c.id}>
                <Link href={`/classes/${c.id}`} className="class-card class-mine">
                  <span className="text-[17px] font-semibold tracking-[-0.01em]">{c.name}</span>
                  <span className="text-[13px] text-[#6e6e73]">
                    {c.subject} · {formatYearGroups(c.yearGroup)}
                  </span>
                  <span className="mt-3 text-[13px] text-[#3a3a3c]">
                    {c.count} pupils
                    {c.attendance.value !== null ? ` · ${c.attendance.value.toFixed(1)}% attendance` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="all-classes-heading" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="all-classes-heading" className={mine.length ? "class-section-title" : "sr-only"}>
              All classes
            </h2>
            <p className={`${mine.length ? "mt-0.5" : ""} text-[13px] text-[#6e6e73]`} role="status">
              {filtersActive ? `${filtered.length} of ${classes.length} classes` : `${classes.length} classes`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <label className="class-search col-span-2 sm:w-[260px]">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="sr-only">Search classes or teachers</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Class or teacher" />
            </label>
            <select aria-label="Year group" className="class-select" value={year} onChange={(e) => setYear(e.target.value)} data-active={year || undefined}>
              <option value="">All year groups</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {formatYearGroups(y)}
                </option>
              ))}
            </select>
            <select aria-label="Subject" className="class-select" value={subject} onChange={(e) => setSubject(e.target.value)} data-active={subject || undefined}>
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {filtersActive ? (
              <button
                type="button"
                className="col-span-2 text-left text-[13px] font-medium underline-offset-4 hover:underline sm:col-span-1 sm:px-1"
                onClick={() => {
                  setSearch("");
                  setYear("");
                  setSubject("");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="class-card px-8 py-14 text-center">
            <h3 className="font-semibold">No classes match</h3>
            <p className="mt-1.5 text-[14px] text-[#6e6e73]">Try another search, or clear the filters.</p>
          </div>
        ) : (
          <div className="class-card overflow-x-auto">
            <table className="class-table w-full min-w-[720px]">
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Year</th>
                  <th scope="col">Teachers</th>
                  <th scope="col" className="text-right">Pupils</th>
                  <th scope="col" className="text-right">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => router.push(`/classes/${c.id}`)}>
                    <td>
                      <Link href={`/classes/${c.id}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.name}
                      </Link>
                      <span className="block text-[12px] text-[#6e6e73]">{c.subject}</span>
                    </td>
                    <td className="whitespace-nowrap">{formatYearGroups(c.yearGroup)}</td>
                    <td>
                      <span className="block max-w-[320px] text-[13px] text-[#3a3a3c]">{teacherSummary(c.teachers)}</span>
                    </td>
                    <td className="text-right tabular-nums">{c.count}</td>
                    <td className="text-right tabular-nums">
                      {c.attendance.value === null ? (
                        <span className="text-[#a1a1aa]">No data</span>
                      ) : (
                        <span className={c.attendance.value < 90 ? "class-low" : undefined}>{c.attendance.value.toFixed(1)}%</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function teacherSummary(teachers: { name: string }[]): string {
  if (!teachers.length) return "No teacher assigned";
  if (teachers.length <= 2) return teachers.map((t) => t.name).join(" and ");
  return `${teachers[0].name}, ${teachers[1].name} and ${teachers.length - 2} more`;
}
