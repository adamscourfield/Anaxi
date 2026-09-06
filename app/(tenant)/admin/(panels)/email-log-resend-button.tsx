"use client";

import { useTransition } from "react";
import { toast } from "@/components/toast-provider";
import type { ActionResult } from "@/app/(tenant)/admin/email-log/actions";

export function ResendEmailButton({
  id,
  resendAction,
}: {
  id: string;
  resendAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const result = await resendAction(fd);
      if (result.ok) {
        toast("Email resent", "success");
      } else {
        toast(result.error, "error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="mt-1 text-xs font-semibold text-accent calm-transition hover:underline disabled:opacity-50"
    >
      {pending ? "Resending…" : "Resend"}
    </button>
  );
}
