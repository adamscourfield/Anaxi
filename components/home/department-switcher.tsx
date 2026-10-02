"use client";

import { useRouter } from "next/navigation";

/**
 * A plain dropdown for switching between departments on the HOD home view.
 * Replaces a row of segmented-toggle buttons, which has no wrap behaviour and
 * ran past the page margins once a school had more than a handful of departments.
 */
export function DepartmentSwitcher({
  depts,
  activeDeptId,
  windowDays,
}: {
  depts: { id: string; name: string }[];
  activeDeptId: string;
  windowDays: number;
}) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted">Department:</span>
      <select
        value={activeDeptId}
        onChange={(e) => router.push(`/home?dept=${e.target.value}&window=${windowDays}`)}
        className="field w-auto"
      >
        {depts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}
