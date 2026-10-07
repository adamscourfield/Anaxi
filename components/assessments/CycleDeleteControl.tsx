"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";
import { toast } from "@/components/toast-provider";

type Props = {
  cycleId: string;
  cycleLabel: string;
  className?: string;
};

export function CycleDeleteControl({ cycleId, cycleLabel, className }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/assessments/cycles/${cycleId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Failed to delete cycle", "error");
        return false;
      }
      toast("Cycle deleted", "success");
      router.push("/assessments");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={className}
        style={{ color: "var(--error)" }}
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Delete cycle
      </Button>
      <DestructiveConfirmDialog
        open={open}
        title={`Delete "${cycleLabel}"?`}
        confirmLabel={busy ? "Deleting…" : "Delete permanently"}
        cancelLabel="Cancel"
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
      >
        This permanently removes the cycle, its points, assessments, and every result recorded against
        them. This cannot be undone.
      </DestructiveConfirmDialog>
    </>
  );
}
