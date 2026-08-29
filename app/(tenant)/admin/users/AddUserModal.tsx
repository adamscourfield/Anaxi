"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/toast-provider";
import type { ActionResult } from "./actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "ADMIN", label: "Administrator" },
  { value: "SLT", label: "Senior Leader" },
  { value: "HOD", label: "Head of Dept" },
  { value: "LEADER", label: "Leader" },
  { value: "TEACHER", label: "Teacher" },
  { value: "HR", label: "HR Officer" },
  { value: "ON_CALL", label: "On-Call Staff" },
];

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const FIELD_LABEL = "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted";

export function AddUserModal({
  onClose,
  createAction,
  canAssignSuperAdmin,
}: {
  onClose: () => void;
  createAction: (formData: FormData) => Promise<ActionResult>;
  canAssignSuperAdmin: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  const roleOptions = canAssignSuperAdmin
    ? [{ value: "SUPER_ADMIN", label: "Super Admin" }, ...ROLE_OPTIONS]
    : ROLE_OPTIONS;

  useEffect(() => {
    setMounted(true);
    const t = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    startTransition(async () => {
      const result = await createAction(fd);
      if (result.ok) {
        toast("Staff member added", "success");
        onClose();
      } else {
        toast(result.error, "error");
      }
    });
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && !pending && onClose()}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-border/35 bg-background shadow-xl"
        role="dialog"
        aria-labelledby="add-user-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/20 px-6 py-5">
          <div>
            <h2 id="add-user-title" className="text-lg font-bold tracking-tight text-text">
              Add staff member
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Creates an active account and emails them a link to set their password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="calm-transition shrink-0 rounded-lg p-2 text-muted hover:bg-surface-container-low hover:text-text disabled:opacity-50"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <FormField id="add-user-name" label="Full name" required>
              <input
                ref={nameRef}
                id="add-user-name"
                name="fullName"
                required
                autoComplete="name"
                className="field w-full rounded-xl border-border/40 bg-background py-2.5 px-3 text-[0.8125rem]"
                placeholder="Jane Smith"
              />
            </FormField>
            <FormField id="add-user-email" label="Email" required>
              <input
                id="add-user-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="field w-full rounded-xl border-border/40 bg-background py-2.5 px-3 text-[0.8125rem]"
                placeholder="jane.smith@school.edu"
              />
            </FormField>
            <label className="block">
              <span className={FIELD_LABEL}>Role</span>
              <select
                name="role"
                defaultValue="TEACHER"
                className="field w-full rounded-xl border-border/40 bg-background py-2.5 px-3 text-[0.8125rem] font-medium"
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Temporary password (optional)</span>
              <input
                name="password"
                type="text"
                autoComplete="new-password"
                className="field w-full rounded-xl border-border/40 bg-background py-2.5 px-3 text-[0.8125rem]"
                placeholder="Password123!"
              />
              <p className="mt-1.5 text-[0.75rem] text-muted">
                Defaults to Password123! if left blank. They&rsquo;ll get an emailed link to set their own password.
              </p>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/20 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg px-2 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text disabled:opacity-50"
            >
              Cancel
            </button>
            <SubmitButton pendingLabel="Adding…">Add staff</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
