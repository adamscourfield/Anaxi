"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { REASON_CATEGORIES, LOCATION_SUGGESTIONS } from "@/modules/oncall/types";

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
    if (!selectedStudent) { setError("Please select a student"); return; }
    if (!location.trim()) { setError("Please enter a location"); return; }
    if (requestType === "BEHAVIOUR" && !reason) {
      setError("Please select a reason");
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
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit");
        return;
      }
      router.push("/on-call");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Volume comparison
  const volumeDiff = yesterdayCount > 0
    ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
    : null;

  const maxBucket = Math.max(...hourlyBuckets, 1);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-text">
            New on call request
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Initiate an immediate response protocol for behavior or medical incidents within the institutional perimeter.
          </p>
        </div>
        <Link
          href="/home#immediate-support-needed"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[var(--error)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] px-4 py-2.5 text-sm font-bold text-[var(--error)] calm-transition hover:bg-[color-mix(in_srgb,var(--error)_14%,transparent)]"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 9v4M12 17h.01M10.3 3.6h3.4l8.3 14.4H2l8.3-14.4z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Emergency
        </Link>
      </div>

      {/* ── Request Details card ───────────────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-surface-container-lowest shadow-sm">
        {/* Card header */}
        <div className="flex items-start gap-3 border-b border-border/20 px-6 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-text">
            <svg className="h-5 w-5 text-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-text">Request Details</p>
            <p className="text-[12px] text-muted">Fill in the incident parameters for deployment.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
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
                    <li key={s.id} role="option">
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
            <div className="grid grid-cols-2 gap-3">
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
                    className={`relative flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left calm-transition ${
                      isActive
                        ? "border-text bg-text/5"
                        : "border-border/50 hover:border-border hover:bg-surface-container-low"
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cat-orange-bg,#fff3cd)]/60 bg-[var(--cat-orange-bg,#fff8e1)] px-4 py-3">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#e65100]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <p className="text-[12px] text-[#bf360c]">
                This request will alert all available on-call staff members immediately.
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-text px-5 py-2.5 text-sm font-semibold text-bg calm-transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit on call request"}
              {!submitting && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Bottom stats row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* On Call Density */}
        <div className="rounded-2xl border border-border/50 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">On Call Density</p>
          <div className="mt-3 flex items-end gap-1 h-10">
            {hourlyBuckets.map((count, i) => {
              const height = maxBucket > 0 ? Math.max(4, Math.round((count / maxBucket) * 40)) : 4;
              const isLast = i === hourlyBuckets.length - 1;
              return (
                <div
                  key={i}
                  title={`${count} request${count !== 1 ? "s" : ""}`}
                  style={{ height: `${height}px` }}
                  className={`flex-1 rounded-sm calm-transition ${
                    isLast
                      ? "bg-text"
                      : count > 0
                      ? "bg-[var(--surface-container-high)]"
                      : "bg-[var(--surface-container)]"
                  }`}
                />
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {isPeakActivity
              ? "Peak activity occurring now · Staff response: ~2 mins"
              : "Activity within normal range"}
          </p>
        </div>

        {/* Today's Volume */}
        <div className="rounded-2xl border border-border/50 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Today&apos;s Volume</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[2.5rem] font-bold leading-none tracking-tight text-text">
              {todayCount}
            </span>
            {volumeDiff !== null && (
              <span className={`text-sm font-semibold ${volumeDiff >= 0 ? "text-[var(--scale-limited-text)]" : "text-[var(--scale-consistent-text)]"}`}>
                {volumeDiff >= 0 ? "+" : ""}{volumeDiff}%
              </span>
            )}
          </div>
          {volumeDiff !== null && (
            <p className="text-[11px] text-muted">vs. yesterday</p>
          )}
          <p className="mt-1 text-[12px] text-muted">
            {todayCount === 0
              ? `No requests yet today`
              : todayCount === 1
              ? `1 request today · ${dayLabel}`
              : `${todayCount <= 5 ? "Low" : todayCount <= 10 ? "Moderate" : "High"} volume for a ${dayLabel}`}
          </p>
        </div>
      </div>
    </div>
  );
}
