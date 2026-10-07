"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";

export function CycleRenameControl({
  cycleId,
  cycleLabel,
  className,
}: {
  cycleId: string;
  cycleLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(cycleLabel);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`/api/assessments/cycles/${cycleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || "Could not rename cycle", "error");
        return;
      }
      toast("Cycle renamed", "success");
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Button type="button" variant="ghost" className={className} onClick={() => setEditing(true)}>
        Rename cycle
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 p-1">
      <label className="sr-only" htmlFor={`cycle-label-${cycleId}`}>Cycle name</label>
      <input
        id={`cycle-label-${cycleId}`}
        value={label}
        maxLength={120}
        onChange={(event) => setLabel(event.target.value)}
        className="h-9 w-full rounded-sm border border-border bg-[var(--surface-container-lowest)] px-3 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <div className="flex items-center gap-2">
        <Button type="button" className="h-9 flex-1" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : "Save name"}</Button>
        <Button type="button" variant="ghost" className="h-9" disabled={busy} onClick={() => { setLabel(cycleLabel); setEditing(false); }}>Cancel</Button>
      </div>
    </div>
  );
}
