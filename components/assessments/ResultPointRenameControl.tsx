"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";

export function ResultPointRenameControl({ pointId, pointLabel }: { pointId: string; pointLabel: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(pointLabel);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`/api/assessments/points/${pointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || "Could not rename result point", "error");
        return;
      }
      toast("Result point renamed", "success");
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!editing) return <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>Rename</Button>;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`point-name-${pointId}`}>Result point name</label>
      <input id={`point-name-${pointId}`} value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} className="h-8 min-w-48 rounded-sm border border-border bg-[var(--surface-container-lowest)] px-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
      <Button type="button" className="h-8 px-3 text-xs" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : "Save"}</Button>
      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={busy} onClick={() => { setLabel(pointLabel); setEditing(false); }}>Cancel</Button>
    </div>
  );
}
