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

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
      />
    </svg>
  );
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
  const [showFilters, setShowFilters] = useState(
    !!(currentYearGroup || currentSend || currentPp || currentBand),
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setQ(currentQ);
    setYearGroup(currentYearGroup);
    setSend(currentSend);
    setPp(currentPp);
    setBand(currentBand);
  }, [currentQ, currentYearGroup, currentSend, currentPp, currentBand]);

  const hasPanelFilters = !!(yearGroup || send || pp || band);

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
    <div className="space-y-3">
      <div className="filter-bar items-center">
        <div className="relative min-w-[200px] flex-1">
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
            placeholder="Search students..."
            className="field w-full !rounded-xl !border-border/40 !bg-surface-container-high/80 !py-2.5 !pl-[2.875rem] pr-4 text-[0.9375rem] shadow-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.8125rem] font-medium calm-transition ${
            showFilters || hasPanelFilters
              ? "border-border/50 bg-surface-container-low text-text"
              : "border-transparent bg-transparent text-muted hover:bg-surface-container-low/80 hover:text-text"
          }`}
        >
          <FilterIcon className="h-4 w-4" />
          Filter
        </button>

        <p className="w-full text-center text-[0.8125rem] text-muted sm:ml-auto sm:w-auto sm:text-right">
          Showing{" "}
          <span className="font-medium text-text">
            {totalFiltered === 0 ? "0" : `${pageStart}–${pageEnd}`}
          </span>{" "}
          of{" "}
          <span className="font-medium text-text">{totalFiltered.toLocaleString()}</span>{" "}
          students
        </p>
      </div>

      {showFilters && (
        <div
          key={`${currentYearGroup}-${currentSend}-${currentPp}-${currentBand}`}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border/30 bg-surface-container-lowest/60 p-4"
        >
          <FormSelect
            name="yearGroup"
            defaultValue={currentYearGroup}
            placeholder="All years"
            className="min-w-[140px]"
            options={yearGroups.map((yg) => ({ value: yg, label: yg }))}
            onChange={setYearGroup}
          />
          <FormSelect
            name="send"
            defaultValue={currentSend}
            placeholder="SEN"
            className="min-w-[120px]"
            options={[
              { value: "true", label: "SEN Yes" },
              { value: "false", label: "SEN No" },
            ]}
            onChange={setSend}
          />
          <FormSelect
            name="pp"
            defaultValue={currentPp}
            placeholder="PP"
            className="min-w-[120px]"
            options={[
              { value: "true", label: "PP Yes" },
              { value: "false", label: "PP No" },
            ]}
            onChange={setPp}
          />
          <FormSelect
            name="band"
            defaultValue={currentBand}
            placeholder="Band"
            className="min-w-[130px]"
            options={[
              { value: "STABLE", label: "Stable" },
              { value: "WATCH", label: "Watch" },
              { value: "PRIORITY", label: "Priority" },
              { value: "URGENT", label: "Urgent" },
            ]}
            onChange={setBand}
          />
          <button
            type="button"
            onClick={apply}
            className="calm-transition inline-flex items-center rounded-lg bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-on-primary hover:bg-accentHover"
          >
            Apply
          </button>
          {(q || yearGroup || send || pp || band) && (
            <button
              type="button"
              onClick={clear}
              className="calm-transition rounded-lg px-3 py-2 text-[0.8125rem] font-medium text-muted hover:text-text"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
