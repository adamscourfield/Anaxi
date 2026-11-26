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
        className="inline-flex h-10 items-center rounded-[10px] border border-[var(--pill-error-ring)] bg-white px-4 text-[14px] font-medium text-[var(--pill-error-text)] calm-transition hover:bg-[var(--pill-error-bg)]"
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
