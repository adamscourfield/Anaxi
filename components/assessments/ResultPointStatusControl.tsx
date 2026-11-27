"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ResultStatus } from "@prisma/client";
import { toast } from "@/components/toast-provider";
import { STATUS_CLASS, STATUS_LABEL, STATUS_MEANING } from "./resultStatus";
import w from "./workspace.module.css";

/** Allowed moves from each status (unchanged). Unlocking is checked again on the server. */
const NEXT_OPTIONS: Record<ResultStatus, ResultStatus[]> = {
  DRAFT: ["VALIDATED", "PUBLISHED", "LOCKED"],
  VALIDATED: ["DRAFT", "PUBLISHED", "LOCKED"],
  PUBLISHED: ["VALIDATED", "LOCKED"],
  LOCKED: ["PUBLISHED"],
};

type Props = { pointId: string; pointLabel?: string; status: ResultStatus };

/** A plain, visible drop-down: the dot shows the current state, the menu lists the allowed next states. */
export function ResultPointStatusControl({ pointId, pointLabel, status }: Props) {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Couldn't change the status", "error");
        return;
      }
      setCurrent(next);
      toast(`${pointLabel ? `${pointLabel}: ` : ""}${STATUS_LABEL[next]}`, "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`${w.statusSelect} ${STATUS_CLASS[current]}`} title={STATUS_MEANING[current]}>
      <span className="sr-only">Status{pointLabel ? ` of ${pointLabel}` : ""}</span>
      <select
        value={current}
        disabled={busy}
        onChange={(e) => void updateStatus(e.target.value as ResultStatus)}
      >
        <option value={current}>{STATUS_LABEL[current]}</option>
        {NEXT_OPTIONS[current].map((s) => (
          <option key={s} value={s}>
            {s === "LOCKED" ? "Lock" : s === "PUBLISHED" && current === "LOCKED" ? "Unlock (back to Published)" : `Mark as ${STATUS_LABEL[s].toLowerCase()}`}
          </option>
        ))}
      </select>
    </label>
  );
}
