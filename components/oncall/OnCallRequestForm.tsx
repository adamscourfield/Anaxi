"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/components/toast-provider";
import { formatYearGroup, type OnCallType } from "./shared";
import styles from "./OnCallRequestForm.module.css";

interface Student {
  id: string;
  fullName: string;
  upn: string | null;
  yearGroup?: string | null;
}

interface OnCallRequestFormProps {
  students: Student[];
  reasons: string[];
  locations: string[];
  /** The school's name for On Call (Admin › Language), used in the breadcrumb. */
  inboxLabel: string;
}

type Field = "student" | "reason" | "location";

const TYPES: { value: OnCallType; title: string; description: string }[] = [
  { value: "BEHAVIOUR", title: "Behaviour", description: "A student needs removing or support with their behaviour." },
  { value: "FIRST_AID", title: "First aid", description: "A student is hurt or unwell and needs a first aider." },
];

/** How many saved locations to offer as one-tap choices. */
const QUICK_LOCATIONS = 8;

export function OnCallRequestForm({ students, reasons, locations, inboxLabel }: OnCallRequestFormProps) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [requestType, setRequestType] = useState<OnCallType>("BEHAVIOUR");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: s.fullName,
    detail: [s.yearGroup ? formatYearGroup(s.yearGroup) : null, s.upn].filter(Boolean).join(" · ") || undefined,
  }));

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (!studentId) next.student = "Choose the student who needs support.";
    if (requestType === "BEHAVIOUR" && !reason) next.reason = "Choose a reason.";
    if (!location.trim()) next.location = "Say where the student is.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      const first = (["student", "reason", "location"] as Field[]).find((f) => found[f]);
      document.getElementById(`oncall-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/oncall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          requestType,
          location: location.trim(),
          behaviourReasonCategory: requestType === "BEHAVIOUR" ? reason : undefined,
          notes: notes.trim() || undefined,
          isEmergency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(typeof data?.error === "string" ? data.error : "The call-out wasn't sent. Try again.");
        return;
      }
      toast("Call-out sent. On-call staff have been alerted.", "success");
      // Land on the request itself, so the sender can watch for someone acknowledging it.
      router.push(data?.id ? `/on-call/${data.id}` : "/on-call");
      router.refresh();
    } catch {
      setFormError("Couldn't reach Anaxi, so the call-out wasn't sent. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const clearError = (field: Field) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  return (
    <div className={`${styles.page} w-full min-w-0 space-y-8 md:mx-auto md:max-w-[760px]`}>
      <PageHeader
        variant="ledger"
        title="Raise a call-out"
        subtitle="On-call staff are alerted the moment you send it."
        eyebrow={<Breadcrumb items={[{ label: inboxLabel, href: "/on-call" }, { label: "Raise a call-out" }]} />}
      />

      <form onSubmit={handleSubmit} noValidate className={styles.card}>
        <div className={styles.field} id="oncall-student">
          <span className={styles.label} id="oncall-student-label">
            Student
          </span>
          <SearchableSelect
            options={studentOptions}
            value={studentId}
            onChange={(v) => {
              setStudentId(v);
              clearError("student");
            }}
            placeholder="Search for a student"
            searchPlaceholder="Name or UPN"
            ariaLabel="Student"
            className="w-full"
          />
          {errors.student ? <p className={styles.error}>{errors.student}</p> : null}
        </div>

        <fieldset className={styles.field}>
          <legend className={styles.label}>What&rsquo;s needed</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => (
              <label key={t.value} className={styles.choice} data-checked={requestType === t.value || undefined}>
                <input
                  type="radio"
                  name="requestType"
                  value={t.value}
                  checked={requestType === t.value}
                  onChange={() => {
                    setRequestType(t.value);
                    clearError("reason");
                  }}
                  className={styles.radio}
                />
                <span>
                  <span className="block text-[14px] font-semibold text-[#1c1c1e]">{t.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[#6e6e73]">{t.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {requestType === "BEHAVIOUR" ? (
          <div className={styles.field} id="oncall-reason">
            <label className={styles.label} htmlFor="oncall-reason-select">
              Reason
            </label>
            <select
              id="oncall-reason-select"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                clearError("reason");
              }}
              className={styles.input}
              aria-invalid={Boolean(errors.reason)}
            >
              <option value="">Choose a reason</option>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {errors.reason ? <p className={styles.error}>{errors.reason}</p> : null}
          </div>
        ) : null}

        <div className={styles.field} id="oncall-location">
          <label className={styles.label} htmlFor="oncall-location-input">
            Where
          </label>
          <input
            id="oncall-location-input"
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              clearError("location");
            }}
            placeholder="Room or place, e.g. Room 12"
            list="oncall-location-suggestions"
            autoComplete="off"
            className={styles.input}
            aria-invalid={Boolean(errors.location)}
          />
          <datalist id="oncall-location-suggestions">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          {locations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Common locations">
              {locations.slice(0, QUICK_LOCATIONS).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={styles.chip}
                  data-selected={location === l || undefined}
                  onClick={() => {
                    setLocation(l);
                    clearError("location");
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          ) : null}
          {errors.location ? <p className={styles.error}>{errors.location}</p> : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="oncall-notes">
            Anything they should know <span className="font-normal text-[#6e6e73]">(optional)</span>
          </label>
          <textarea
            id="oncall-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${styles.input} min-h-[88px] resize-y py-2.5`}
            placeholder="What's happening, and anything that will help whoever comes"
          />
        </div>

        <label className={styles.emergency} data-checked={isEmergency || undefined}>
          <input
            type="checkbox"
            checked={isEmergency}
            onChange={(e) => setIsEmergency(e.target.checked)}
            className={styles.checkbox}
          />
          <span>
            <span className="block text-[14px] font-semibold text-[#1c1c1e]">This is an emergency</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-[#6e6e73]">
              Puts it at the top of everyone&rsquo;s list and marks the alert as urgent. Use it when someone is at risk of harm.
            </span>
          </span>
        </label>

        {formError ? (
          <p role="alert" className="rounded-[10px] border border-[var(--pill-error-ring)] bg-[var(--pill-error-bg)] px-3.5 py-2.5 text-[13px] text-[var(--pill-error-text)]">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-[#efeff0] pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" asChild className="h-11 min-h-0 px-5">
            <Link href="/on-call">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            variant={isEmergency ? "danger" : "primary"}
            className="h-11 min-h-0 px-6"
          >
            {submitting ? "Sending…" : isEmergency ? "Send emergency call-out" : "Send call-out"}
          </Button>
        </div>
      </form>
    </div>
  );
}
