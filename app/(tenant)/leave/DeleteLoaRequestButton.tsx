"use client";

import { useRef, useState } from "react";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";
import { deleteLoaRequest } from "./actions";

export function DeleteLoaRequestButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[color-mix(in_srgb,var(--error)_40%,transparent)] px-5 py-2.5 text-[0.875rem] font-semibold text-[var(--error)] calm-transition hover:bg-[var(--status-denied-light)]"
      >
        Delete request
      </button>
      <form ref={formRef} action={deleteLoaRequest} className="hidden" aria-hidden="true">
        <input type="hidden" name="requestId" value={requestId} />
      </form>
      <DestructiveConfirmDialog
        open={open}
        title="Delete this leave request?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onClose={() => setOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
      >
        This will permanently remove this leave request and cannot be undone.
      </DestructiveConfirmDialog>
    </>
  );
}
