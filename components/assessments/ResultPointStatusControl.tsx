"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ResultStatus } from "@prisma/client";
import { toast } from "@/components/toast-provider";
import { resultStatusPillClasses } from "@/modules/assessments/attainmentColours";

const STATUS_LABELS: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

const NEXT_OPTIONS: Record<ResultStatus, ResultStatus[]> = {
  DRAFT: ["VALIDATED", "PUBLISHED", "LOCKED"],
  VALIDATED: ["DRAFT", "PUBLISHED", "LOCKED"],
  PUBLISHED: ["VALIDATED", "LOCKED"],
  LOCKED: ["PUBLISHED"],
};

type Props = {
  pointId: string;
  status: ResultStatus;
};

/**
 * Status pill doubles as its own trigger: a transparent native `<select>` is
 * layered over the pill, so the badge itself is the clickable control
 * instead of a separate "Set status…" field sitting next to it.
 */
export function ResultPointStatusControl({ pointId, status }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);

  async function updateStatus(next: ResultStatus) {
    if (next === current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/points/${pointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultStatus: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to update status", "error");
        return;
      }
      setCurrent(next);
      toast(`Status set to ${STATUS_LABELS[next]}`, "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const options = NEXT_OPTIONS[current];
  const canChange = options.length > 0 && !busy;

  return (
    <div className="relative inline-flex">
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${resultStatusPillClasses[current]} ${canChange ? "pr-4" : ""} ${busy ? "opacity-60" : ""}`}
        title={
          current === "LOCKED"
            ? "Locked — CSV uploads disabled. Choose Published to unlock."
            : canChange
              ? "Click to change status"
              : undefined
        }
      >
        {STATUS_LABELS[current]}
        {canChange && (
          <svg className="absolute right-1 h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {canChange && (
        <select
          aria-label="Change result point status"
          disabled={busy}
          value=""
          onChange={(e) => {
            const v = e.target.value as ResultStatus;
            if (v) void updateStatus(v);
            e.target.value = "";
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
        >
          <option value="" disabled>
            {STATUS_LABELS[current]}
          </option>
          {options.map((s) => (
            <option key={s} value={s}>
              → {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
