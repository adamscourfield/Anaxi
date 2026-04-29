"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { REASON_CATEGORIES, LOCATION_SUGGESTIONS } from "@/modules/oncall/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";

interface Student {
  id: string;
  fullName: string;
  upn: string;
  yearGroup?: string | null;
}

interface OnCallRequestFormProps {
  students: Student[];
  hourlyBuckets: number[];
  todayCount: number;
  yesterdayCount: number;
  dayLabel: string;
  isPeakActivity: boolean;
}

export function OnCallRequestForm({
  students,
  hourlyBuckets,
  todayCount,
  yesterdayCount,
  dayLabel,
  isPeakActivity,
}: OnCallRequestFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [requestType, setRequestType] = useState<"BEHAVIOUR" | "FIRST_AID">("BEHAVIOUR");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = query.length > 0
    ? students.filter((s) =>
        s.fullName.toLowerCase().includes(query.toLowerCase()) ||
        s.upn.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) { setError("Please select a student"); toast("Please select a student", "error"); return; }
    if (!location.trim()) { setError("Please enter a location"); toast("Please enter a location", "error"); return; }
    if (requestType === "BEHAVIOUR" && !reason) {
      setError("Please select a reason");
      toast("Please select a reason", "error");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/oncall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          requestType,
          location,
          behaviourReasonCategory: requestType === "BEHAVIOUR" ? reason : undefined,
          notes: notes || undefined,
          isEmergency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit");
        toast(data.error ?? "Failed to submit", "error");
        return;
      }
      toast("On-call request raised", "success");
      router.push("/on-call");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      toast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // Volume comparison
  const volumeDiff = yesterdayCount > 0
    ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
    : null;

  const maxBucket = Math.max(...hourlyBuckets, 1);

  const recentWindowTotal = hourlyBuckets.reduce((a, b) => a + b, 0);

  return (
    <div className="w-full min-w-0 space-y-8 md:mx-auto md:max-w-2xl">
      {/* ── Page header ───────────────────────────────────────────── */}
      <header className="anx-page-header-shell">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0 space-y-2">
            <h1 className="text-pretty text-[clamp(1.625rem,3.5vw,2rem)] font-bold leading-[1.1] tracking-[-0.035em] text-text">
              New on call request
            </h1>
            <p className="max-w-xl text-pretty text-[0.9375rem] leading-relaxed text-muted/90">
              Initiate an immediate response protocol for behavior or medical incidents within the institutional perimeter.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isEmergency}
            onClick={() => setIsEmergency((v) => !v)}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold shadow-sm calm-transition ${
              isEmergency
                ? "border-[var(--error)] bg-[color-mix(in_srgb,var(--pill-error-bg)_80%,transparent)] text-[var(--error)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--error)_25%,transparent)]"
                : "border-[color-mix(in_srgb,var(--outline-variant)_38%,transparent)] bg-[var(--surface-container-lowest)] text-muted hover:border-text/20 hover:text-text"
            }`}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 9v4M12 17h.01M10.3 3.6h3.4l8.3 14.4H2l8.3-14.4z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Emergency
          </button>
        </div>
      </header>

      {/* ── Request Details card ───────────────────────────────────── */}
      <div className="home-hero-glass overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_14px_44px_-14px_rgba(0,0,0,0.08)]">
        {/* Card header */}
        <div className="flex items-start gap-3.5 border-b border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] px-5 py-5 sm:px-7">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tertiary-container)] text-[var(--on-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-base font-bold tracking-[-0.02em] text-text">Request Details</p>
            <p className="mt-0.5 text-pretty text-sm text-muted">Fill in the incident parameters for deployment</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
          {/* Student */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Student
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                ref={searchRef}
                type="text"
                value={selectedStudent ? selectedStudent.fullName : query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedStudent(null);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by name or UPN..."
                className="field pl-11"
                autoComplete="off"
              />
              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => { setSelectedStudent(null); setQuery(""); }}
                  className="absolute inset-y-0 right-3 flex items-center text-muted hover:text-error calm-transition"
                >
                  <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              {showDropdown && filtered.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border/70 bg-surface shadow-md"
                >
                  {filtered.map((s) => (
                    <li key={s.id} role="option" aria-selected={selectedStudent?.id === s.id}>
                      <button
                        type="button"
                        className="calm-transition w-full cursor-pointer px-3 py-2.5 text-left text-sm text-text hover:bg-divider/50"
                        onMouseDown={() => {
                          setSelectedStudent(s);
                          setQuery("");
                          setShowDropdown(false);
                        }}
                      >
                        {s.fullName}{" "}
                        <span className="text-muted">
                          ({s.upn}{s.yearGroup ? ` · ${s.yearGroup}` : ""})
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Request Type – card selection */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Request Type
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["BEHAVIOUR", "FIRST_AID"] as const).map((t) => {
                const isActive = requestType === t;
                const icon = t === "BEHAVIOUR" ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                );
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRequestType(t)}
                    className={`relative flex items-center gap-3 rounded-[14px] border-2 px-4 py-4 text-left calm-transition ${
                      isActive
                        ? "border-text bg-[color-mix(in_srgb,var(--primary)_04%,transparent)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)]"
                        : "border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] hover:border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] hover:bg-[var(--surface-container-low)]/60"
                    }`}
                  >
                    <div className={`shrink-0 ${isActive ? "text-text" : "text-muted"}`}>
                      {icon}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isActive ? "text-text" : "text-muted"}`}>
                        {t === "BEHAVIOUR" ? "Behaviour" : "First Aid"}
                      </p>
                      <p className={`text-[11px] ${isActive ? "text-muted" : "text-border"}`}>
                        {t === "BEHAVIOUR" ? "Assistance with conduct" : "Medical support required"}
                      </p>
                    </div>
                    {/* Radio indicator */}
                    <div className={`absolute top-3 right-3 h-4 w-4 rounded-full border-2 flex items-center justify-center ${isActive ? "border-text" : "border-border"}`}>
                      {isActive && <div className="h-2 w-2 rounded-full bg-text" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          {requestType === "BEHAVIOUR" && (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="field"
                required
              >
                <option value="">Select reason...</option>
                {REASON_CATEGORIES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Location
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Hallway, Room 12..."
                list="location-suggestions"
                className="field pl-11"
                required
              />
              <datalist id="location-suggestions">
                {LOCATION_SUGGESTIONS.map((l) => <option key={l} value={l} />)}
              </datalist>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Notes <span className="font-normal normal-case tracking-normal text-muted">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="field resize-none"
              placeholder="Additional context regarding the environment or specific student needs..."
            />
          </div>

          {error && (
            <div className="rounded-xl border border-error/20 bg-[var(--pill-error-bg)] px-3 py-2.5">
              <p className="text-sm text-[var(--pill-error-text)]">{error}</p>
            </div>
          )}

          {/* Warning + Submit */}
          <div className="flex flex-col gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--pill-warning-bg)_55%,var(--surface-container-lowest))] px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <p className="min-w-0 text-pretty text-[13px] font-medium leading-relaxed text-[var(--warning-text)]">
                This request will alert all available on-call staff members immediately.
              </p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full gap-2 rounded-full px-7 py-3 text-sm font-semibold shadow-md sm:w-auto">
              {submitting ? "Submitting..." : "Submit on call request"}
              {!submitting && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Bottom stats row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="explorer-kpi-tile flex gap-4 rounded-2xl p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-muted ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">On call density</p>
            <p className="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] text-text tabular-nums">{recentWindowTotal}</p>
            <p className="mt-2 text-xs text-muted">Requests in the last 8 hours</p>
            <div className="mt-3 flex h-8 items-end gap-1">
              {hourlyBuckets.map((count, i) => {
                const height = maxBucket > 0 ? Math.max(3, Math.round((count / maxBucket) * 28)) : 3;
                const isLast = i === hourlyBuckets.length - 1;
                return (
                  <div
                    key={i}
                    title={`${count} request${count !== 1 ? "s" : ""}`}
                    style={{ height: `${height}px` }}
                    className={`flex-1 rounded-sm calm-transition ${
                      isLast ? "bg-primary" : count > 0 ? "bg-[var(--surface-container-high)]" : "bg-[var(--surface-container)]"
                    }`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {isPeakActivity ? "Elevated activity in the current hour." : "Activity within normal range."}
            </p>
          </div>
        </div>

        <div className="explorer-kpi-tile flex gap-4 rounded-2xl p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-muted ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18 9l-5 5-2-2-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Today&apos;s volume</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-[2rem] font-bold leading-none tracking-[-0.03em] text-text tabular-nums">{todayCount}</span>
              {volumeDiff !== null && (
                <span className={`text-xs font-semibold tabular-nums ${volumeDiff >= 0 ? "text-[var(--scale-limited-text)]" : "text-[var(--scale-consistent-text)]"}`}>
                  {volumeDiff >= 0 ? "+" : ""}
                  {volumeDiff}%
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">Requests today</p>
            {volumeDiff !== null && <p className="mt-0.5 text-[11px] text-muted">vs. yesterday</p>}
            <p className="mt-2 text-[11px] leading-snug text-muted">
              {todayCount === 0
                ? "No requests yet today."
                : todayCount === 1
                  ? `1 request · ${dayLabel}`
                  : `${todayCount <= 5 ? "Low" : todayCount <= 10 ? "Moderate" : "High"} volume · ${dayLabel}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
