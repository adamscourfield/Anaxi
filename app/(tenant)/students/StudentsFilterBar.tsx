"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { FormSelect } from "@/components/ui/form-select";

interface Props {
  yearGroups: string[];
  currentQ: string;
  currentYearGroup: string;
  currentSend: string;
  currentPp: string;
  currentBand: string;
  pageStart: number;
  pageEnd: number;
  totalFiltered: number;
}

export function StudentsFilterBar({
  yearGroups,
  currentQ,
  currentYearGroup,
  currentSend,
  currentPp,
  currentBand,
  pageStart,
  pageEnd,
  totalFiltered,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(currentQ);
  const [yearGroup, setYearGroup] = useState(currentYearGroup);
  const [send, setSend] = useState(currentSend);
  const [pp, setPp] = useState(currentPp);
  const [band, setBand] = useState(currentBand);
  const [, startTransition] = useTransition();

  const triggerWhite = "field-filter-trigger";

  useEffect(() => {
    setQ(currentQ);
    setYearGroup(currentYearGroup);
    setSend(currentSend);
    setPp(currentPp);
    setBand(currentBand);
  }, [currentQ, currentYearGroup, currentSend, currentPp, currentBand]);

  const hasAnyFilter = !!(q || yearGroup || send || pp || band);

  function pushWithParams(params: URLSearchParams) {
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(`/students${qs ? `?${qs}` : ""}`);
    });
  }

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (q) params.set("q", q);
    else params.delete("q");
    if (yearGroup) params.set("yearGroup", yearGroup);
    else params.delete("yearGroup");
    if (send) params.set("send", send);
    else params.delete("send");
    if (pp) params.set("pp", pp);
    else params.delete("pp");
    if (band) params.set("band", band);
    else params.delete("band");
    pushWithParams(params);
  }

  function clear() {
    setQ("");
    setYearGroup("");
    setSend("");
    setPp("");
    setBand("");
    startTransition(() => {
      router.push("/students");
    });
  }

  return (
    <div className="filter-panel">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[200px] lg:max-w-[min(100%,360px)]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Search</span>
          <div className="relative w-full">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m17 17 4 4" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              placeholder="Search by name or UPN…"
              className={`field w-full !py-2.5 !pl-[2.875rem] pr-3 !text-[0.8125rem] ${triggerWhite}`}
            />
          </div>
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Year group</span>
          <FormSelect
            name="yearGroup"
            defaultValue={currentYearGroup}
            placeholder="All years"
            triggerClassName={triggerWhite}
            className="min-w-0"
            options={[
              { value: "", label: "All years" },
              ...yearGroups.map((yg) => ({ value: yg, label: yg })),
            ]}
            onChange={setYearGroup}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[130px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">SEN</span>
          <FormSelect
            name="send"
            defaultValue={currentSend}
            placeholder="All"
            triggerClassName={triggerWhite}
            className="min-w-0"
            options={[
              { value: "", label: "All" },
              { value: "true", label: "SEN Yes" },
              { value: "false", label: "SEN No" },
            ]}
            onChange={setSend}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[130px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Pupil premium</span>
          <FormSelect
            name="pp"
            defaultValue={currentPp}
            placeholder="All"
            triggerClassName={triggerWhite}
            className="min-w-0"
            options={[
              { value: "", label: "All" },
              { value: "true", label: "PP Yes" },
              { value: "false", label: "PP No" },
            ]}
            onChange={setPp}
          />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Risk band</span>
          <FormSelect
            name="band"
            defaultValue={currentBand}
            placeholder="All bands"
            triggerClassName={triggerWhite}
            className="min-w-0"
            options={[
              { value: "", label: "All bands" },
              { value: "STABLE", label: "Stable" },
              { value: "WATCH", label: "Watch" },
              { value: "PRIORITY", label: "Priority" },
              { value: "URGENT", label: "Urgent" },
            ]}
            onChange={setBand}
          />
        </label>

        <div className="filter-actions">
          <button type="button" onClick={apply} className="btn-filter-primary">
            Apply Filters
          </button>
          {hasAnyFilter && (
            <button type="button" onClick={clear} className="btn-filter-secondary">
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 border-t border-border/20 pt-4 text-center text-[0.8125rem] text-muted sm:text-right">
        Showing{" "}
        <span className="font-semibold text-text">
          {totalFiltered === 0 ? "0" : `${pageStart}–${pageEnd}`}
        </span>{" "}
        of <span className="font-semibold text-text">{totalFiltered.toLocaleString()}</span> students
      </p>
    </div>
  );
}
