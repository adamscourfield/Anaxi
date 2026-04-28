"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "@/components/toast-provider";

/** Must be rendered inside a <form>. Fires a success toast when a server action finishes (pending → idle). */
export function FormSuccessToast({ message }: { message: string }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) wasPending.current = true;
    if (!pending && wasPending.current) {
      wasPending.current = false;
      toast(message, "success");
    }
  }, [pending, message]);

  return null;
}

/** Client wrapper so server actions can show a toast after submit without mixing hooks into server files. */
export function FormWithSuccessToast({
  action,
  successMessage,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  successMessage: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action={action} className={className}>
      <FormSuccessToast message={successMessage} />
      {children}
    </form>
  );
}
