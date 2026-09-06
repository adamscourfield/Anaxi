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
  { value: "SUPPORT", label: "Support" },
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

type ExistingAccount = { fullName: string; roleLabel: string; schoolName: string; hasPassword: boolean };

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
  const [existingAccounts, setExistingAccounts] = useState<ExistingAccount[]>([]);
  const [linkExisting, setLinkExisting] = useState(true);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleOptions = canAssignSuperAdmin
    ? [{ value: "SUPER_ADMIN", label: "Super Admin" }, ...ROLE_OPTIONS]
    : ROLE_OPTIONS;

  useEffect(() => {
    setMounted(true);
    const t = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const email = e.target.value.trim();
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!email.includes("@")) {
      setExistingAccounts([]);
      return;
    }
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/lookup-email?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        setExistingAccounts(data.accounts ?? []);
      } catch {
        setExistingAccounts([]);
      }
    }, 400);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("linkExisting", String(existingAccounts.length > 0 && linkExisting));

    startTransition(async () => {
      const result = await createAction(fd);
      if (result.ok) {
        toast(
          result.linkedNewPassword
            ? "Staff member added — the temporary password now works at both schools."
            : result.linked
              ? "Staff member added — they'll sign in with their existing password."
              : "Staff member added",
          "success",
        );
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
                onChange={handleEmailChange}
                className="field w-full rounded-xl border-border/40 bg-background py-2.5 px-3 text-[0.8125rem]"
                placeholder="jane.smith@school.edu"
              />
            </FormField>
            {existingAccounts.length > 0 && (
              <div className="rounded-xl border border-[var(--info)]/30 bg-[var(--info)]/10 p-3.5 text-[0.8125rem] text-text">
                <p>
                  <strong>{existingAccounts[0].fullName}</strong> already has an account at{" "}
                  <strong>{existingAccounts[0].schoolName}</strong> ({existingAccounts[0].roleLabel}) with this
                  email.
                </p>
                <label className="mt-2.5 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={linkExisting}
                    onChange={(e) => setLinkExisting(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    {existingAccounts[0].hasPassword ? (
                      <>
                        Link accounts — they&rsquo;ll sign in with their existing password and choose which school
                        to open, instead of getting a separate password here.
                      </>
                    ) : (
                      <>
                        Link accounts — they haven&rsquo;t set a password at {existingAccounts[0].schoolName} yet,
                        so the temporary password below will be set on both accounts.
                      </>
                    )}
                  </span>
                </label>
              </div>
            )}
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
            {(() => {
              const linkingToExistingPassword =
                existingAccounts.length > 0 && linkExisting && existingAccounts[0].hasPassword;
              const linkingToUnsetPassword =
                existingAccounts.length > 0 && linkExisting && !existingAccounts[0].hasPassword;
              return (
                <label className={`block ${linkingToExistingPassword ? "opacity-40" : ""}`}>
                  <span className={FIELD_LABEL}>Temporary password (optional)</span>
                  <input
                    name="password"
                    type="text"
                    autoComplete="new-password"
                    disabled={linkingToExistingPassword}
                    className="field w-full rounded-xl border-border/40 bg-background py-2.5 px-3 text-[0.8125rem] disabled:cursor-not-allowed"
                    placeholder="Password123!"
                  />
                  <p className="mt-1.5 text-[0.75rem] text-muted">
                    {linkingToExistingPassword
                      ? "Not needed — linked accounts reuse the existing password."
                      : linkingToUnsetPassword
                        ? `Defaults to Password123! if left blank. This will also become their password at ${existingAccounts[0].schoolName}.`
                        : "Defaults to Password123! if left blank. They'll get an emailed link to set their own password."}
                  </p>
                </label>
              );
            })()}
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
