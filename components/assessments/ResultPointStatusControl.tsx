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
  compact?: boolean;
};

export function ResultPointStatusControl({ pointId, status, compact = false }: Props) {
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

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "gap-2"}`}>
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${resultStatusPillClasses[current]}`}
        title={
          current === "LOCKED"
            ? "Locked — CSV uploads disabled. Choose Published to unlock."
            : undefined
        }
      >
        {STATUS_LABELS[current]}
      </span>
      <label className="sr-only" htmlFor={`status-${pointId}`}>
        Change result point status
      </label>
      <select
        id={`status-${pointId}`}
        disabled={busy}
        value=""
        onChange={(e) => {
          const v = e.target.value as ResultStatus;
          if (v) void updateStatus(v);
          e.target.value = "";
        }}
        className="field h-7 max-w-[9rem] py-0 text-[11px]"
      >
        <option value="">Set status…</option>
        {options.map((s) => (
          <option key={s} value={s}>
            → {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
