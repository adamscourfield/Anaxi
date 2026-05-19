"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";

type Props = {
  cycleId: string;
  isActive: boolean;
};

export function CycleArchiveControl({ cycleId, isActive }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleArchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/cycles/${cycleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to update cycle", "error");
        return;
      }
      toast(isActive ? "Cycle archived" : "Cycle restored to active", "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="ghost" disabled={busy} onClick={() => void toggleArchive()}>
      {busy ? "Saving…" : isActive ? "Archive cycle" : "Restore cycle"}
    </Button>
  );
}
