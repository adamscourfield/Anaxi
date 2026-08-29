"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { selectivePromoteYearGroupAction } from "../../actions";

type StudentRow = { id: string; fullName: string; upn: string | null };

export function SelectivePromotionForm({
  yearGroup,
  nextYearGroup,
  students,
}: {
  yearGroup: string;
  nextYearGroup: string;
  students: StudentRow[];
}) {
  const [continuing, setContinuing] = useState<Set<string>>(new Set());

  const allSelected = continuing.size === students.length;

  function toggle(id: string) {
    setContinuing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setContinuing(allSelected ? new Set() : new Set(students.map((s) => s.id)));
  }

  const leavingCount = students.length - continuing.size;

  return (
    <form action={selectivePromoteYearGroupAction} className="space-y-4">
      <input type="hidden" name="yearGroup" value={yearGroup} />
      {Array.from(continuing).map((id) => (
        <input key={id} type="hidden" name="continuingStudentId" value={id} />
      ))}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Check students who continue into <span className="font-semibold text-text">{nextYearGroup}</span>.
          Everyone left unchecked in {yearGroup} will be archived as a leaver.
        </p>
        <button type="button" onClick={toggleAll} className="link-accent shrink-0 text-xs font-medium">
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="table-shell">
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="w-10 px-4 py-2.5"></th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5 text-muted">UPN</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="table-row calm-transition">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={continuing.has(student.id)}
                      onChange={() => toggle(student.id)}
                      className="h-4 w-4 rounded border-border"
                      aria-label={`${student.fullName} continues into ${nextYearGroup}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-text">{student.fullName}</td>
                  <td className="px-4 py-2 font-mono text-[12px] text-muted">{student.upn ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {continuing.size} continuing to {nextYearGroup} · {leavingCount} to be archived
        </p>
        <Button type="submit">Confirm promotion</Button>
      </div>
    </form>
  );
}
