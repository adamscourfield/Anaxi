"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CoachingFilters } from "@/components/admin/coaching-filters";

type Assignment = {
  coachUserId: string;
  coacheeUserId: string;
  coachName: string;
  coacheeName: string;
};

const CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

export function CoachingAssignmentsView({
  assignments,
  totalCount,
  removeAssignment,
}: {
  assignments: Assignment[];
  totalCount: number;
  removeAssignment: (formData: FormData) => Promise<void>;
}) {
  const [coach, setCoach] = useState("");
  const [coachee, setCoachee] = useState("");

  const filtered = useMemo(() => {
    const coachQ = coach.trim().toLowerCase();
    const coacheeQ = coachee.trim().toLowerCase();
    return assignments.filter((a) => {
      const coachName = a.coachName.toLowerCase();
      const coacheeName = a.coacheeName.toLowerCase();
      return (!coachQ || coachName.includes(coachQ)) && (!coacheeQ || coacheeName.includes(coacheeQ));
    });
  }, [assignments, coach, coachee]);

  const hasFilters = Boolean(coach.trim() || coachee.trim());

  return (
    <>
      <CoachingFilters
        coach={coach}
        coachee={coachee}
        hasFilters={hasFilters}
        onCoachChange={setCoach}
        onCoacheeChange={setCoachee}
        onClear={() => {
          setCoach("");
          setCoachee("");
        }}
      />
      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-transparent">
                <th className="px-6 py-3.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] sm:px-8">
                  Coach
                </th>
                <th className="w-[3rem] px-1 py-3.5 text-center sm:w-14" aria-hidden />
                <th className="px-6 py-3.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] sm:px-8">
                  Coachee
                </th>
                <th className="w-[1%] whitespace-nowrap px-6 py-3.5 text-right text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] sm:px-8">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[0.8125rem] text-[var(--on-surface-variant)] sm:px-8">
                    No assignments match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={`${a.coachUserId}-${a.coacheeUserId}`}
                    className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] last:border-b-0"
                  >
                    <td className="px-6 py-5 align-middle sm:px-8">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={a.coachName} size="md" />
                        <span className="truncate text-[0.8125rem] font-semibold text-[var(--on-surface)]">{a.coachName}</span>
                      </div>
                    </td>
                    <td className="px-1 py-5 text-center align-middle text-[var(--on-surface-variant)]">
                      <span className="text-lg font-normal tabular-nums" aria-hidden>
                        →
                      </span>
                      <span className="sr-only">to</span>
                    </td>
                    <td className="px-6 py-5 align-middle sm:px-8">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={a.coacheeName} size="md" />
                        <span className="truncate text-[0.8125rem] font-medium text-[var(--on-surface)]">{a.coacheeName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-5 text-right align-middle sm:px-8">
                      <form action={removeAssignment} className="inline">
                        <input type="hidden" name="coachUserId" value={a.coachUserId} />
                        <input type="hidden" name="coacheeUserId" value={a.coacheeUserId} />
                        <button
                          type="submit"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] calm-transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          title="Remove assignment"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-4 w-4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-6 py-3.5 sm:px-8">
          <p className="text-[0.8125rem] text-[var(--on-surface-variant)]">
            Showing <span className="font-semibold text-[var(--on-surface)]">{filtered.length}</span>
            {filtered.length !== totalCount ? (
              <>
                {" "}
                of <span className="font-semibold text-[var(--on-surface)]">{totalCount}</span>
              </>
            ) : null}{" "}
            assignment{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </>
  );
}
