"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ui/form-select";
import { LEAVE_MEDICAL_MIN_BUSINESS_DAYS } from "@/lib/leavePolicy";

export type LeaveReasonOption = {
  id: string;
  label: string;
  requiresMedicalEvidence: boolean;
};

export function LeaveReasonFields({ reasons }: { reasons: LeaveReasonOption[] }) {
  const [reasonId, setReasonId] = useState("");
  const selectedReason = reasons.find((r) => r.id === reasonId);
  const showMedicalEvidence = selectedReason?.requiresMedicalEvidence ?? false;

  return (
    <>
      <div className="home-hero-glass rounded-sm border border-border p-5 shadow-none sm:p-6">
        <div className="space-y-4">
          <label htmlFor="loa-reason" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Reason for leave
          </label>
          <FormSelect
            name="reasonId"
            placeholder="Select leave type…"
            triggerClassName="rounded-xl bg-[var(--surface-container-low)]/80"
            options={reasons.map((reason) => ({ value: reason.id, label: reason.label }))}
            onChange={setReasonId}
          />
          <textarea
            id="loa-reason-text"
            name="reasonText"
            className="field min-h-[100px] resize-y rounded-xl bg-[var(--surface-container-low)]/80"
            placeholder="Briefly explain the necessity for absence..."
            rows={4}
          />
        </div>
      </div>

      <div className="home-hero-glass rounded-sm border border-border p-5 shadow-none sm:p-6">
        <div className="space-y-3">
          <label htmlFor="loa-cover" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Cover requirements
          </label>
          <textarea
            id="loa-cover"
            name="coverRequirements"
            className="field min-h-[100px] resize-y rounded-xl bg-[var(--surface-container-low)]/80"
            placeholder="Specify classes or duties requiring coverage..."
            rows={4}
          />
        </div>
      </div>

      {showMedicalEvidence ? (
        <div className="home-hero-glass rounded-sm border border-border p-5 shadow-none sm:p-6">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v8M8 12h8" strokeLinecap="round" />
              </svg>
              Medical evidence
            </label>
            <p className="text-[0.75rem] leading-snug text-muted">
              Required for absences of {LEAVE_MEDICAL_MIN_BUSINESS_DAYS} or more consecutive working days.
            </p>
            <label
              htmlFor="loa-medical"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] bg-[var(--surface-container-low)]/40 px-4 py-8 calm-transition hover:border-text/20"
            >
              <svg className="mb-3 h-9 w-9 text-muted/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6M9 15l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-[0.875rem] font-semibold text-text">Choose file (PDF, JPG, PNG — max 5MB)</p>
              <input
                id="loa-medical"
                type="file"
                name="medicalEvidence"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="mt-3 max-w-full text-[0.75rem] text-muted file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-container-high)] file:px-3 file:py-1.5 file:text-[0.75rem] file:font-semibold file:text-text"
              />
            </label>
            <p className="flex items-center gap-2 text-[11px] text-muted">
              <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Your files are secure and only visible to authorized administrators.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
