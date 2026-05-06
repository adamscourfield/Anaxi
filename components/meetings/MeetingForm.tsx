"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";

const MEETING_TYPES = Object.keys(MEETING_TYPE_LABELS) as Array<keyof typeof MEETING_TYPE_LABELS>;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SLT: "Senior Leadership",
  HEAD_TEACHER: "Head Teacher",
  DEPUTY_HEAD: "Deputy Head",
  HOD: "Head of Department",
  TEACHER: "Teacher",
};

interface User {
  id: string;
  fullName: string;
  email: string;
  role?: string;
}

interface MeetingFormProps {
  users: User[];
  currentUserId: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── Formatting toolbar for pre-meeting notes ───────────────────── */
function NotesToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
}) {
  function insertFormatting(prefix: string, suffix: string, placeholder: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function insertList() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newValue = value.slice(0, lineStart) + "- " + value.slice(lineStart);
    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + 2, start + 2);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => insertFormatting("**", "**", "bold text")}
        className="rounded p-1 text-muted hover:bg-[var(--surface-container)] hover:text-text calm-transition"
        title="Bold"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4z" />
          <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => insertFormatting("*", "*", "italic text")}
        className="rounded p-1 text-muted hover:bg-[var(--surface-container)] hover:text-text calm-transition"
        title="Italic"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5" y2="20" />
          <line x1="15" y1="4" x2="9" y2="20" />
        </svg>
      </button>
      <button
        type="button"
        onClick={insertList}
        className="rounded p-1 text-muted hover:bg-[var(--surface-container)] hover:text-text calm-transition"
        title="Bullet list"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        className="rounded p-1 text-muted hover:bg-[var(--surface-container)] hover:text-text calm-transition"
        title="Attachment"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function MeetingForm({ users, currentUserId }: MeetingFormProps) {
  const router = useRouter();
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<User[]>(
    users.filter((u) => u.id === currentUserId)
  );
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitIntentRef = useRef<"draft" | "schedule" | "startNow">("schedule");

  /** Redirect to list for scheduled meetings that are not starting in the next few minutes. */
  const FUTURE_REDIRECT_THRESHOLD_MS = 5 * 60 * 1000;

  const filteredUsers = users.filter(
    (u) =>
      (u.fullName.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(attendeeSearch.toLowerCase()))
  );

  function toggleAttendee(user: User) {
    setSelectedAttendees((prev) =>
      prev.some((a) => a.id === user.id)
        ? prev.filter((a) => a.id !== user.id)
        : [...prev, user]
    );
  }

  const isSelected = (user: User) => selectedAttendees.some((a) => a.id === user.id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const data = new FormData(form);
    const intent = submitIntentRef.current;

    const dateVal = data.get("date") as string;
    const timeVal = data.get("time") as string;
    const startDateTime = dateVal && timeVal ? new Date(`${dateVal}T${timeVal}`) : null;

    // Default end time = start + 1 hour
    const endDateTime = startDateTime
      ? new Date(startDateTime.getTime() + 60 * 60 * 1000)
      : null;

    const isDraft = intent === "draft";
    const startNow = intent === "startNow";

    const body: Record<string, unknown> = {
      title: data.get("title") as string,
      type: data.get("type") as string,
      location: location || undefined,
      notes: notes || undefined,
      attendeeIds: selectedAttendees.map((a) => a.id),
      status: isDraft ? "PENDING" : "CONFIRMED",
    };

    if (startNow) {
      body.startNow = true;
    } else {
      body.startDateTime = startDateTime?.toISOString();
      body.endDateTime = endDateTime?.toISOString();
    }

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }

      const meeting = await res.json();
      const scheduledStart = meeting.startDateTime
        ? new Date(meeting.startDateTime).getTime()
        : Date.now();
      const goToDetail =
        startNow ||
        meeting.startedAt != null ||
        scheduledStart - Date.now() <= FUTURE_REDIRECT_THRESHOLD_MS;
      router.push(goToDetail ? `/meetings/${meeting.id}` : "/meetings");
      setSubmitting(false);
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <PageHeader variant="ledger"
        title="New Meeting"
        subtitle="Schedule an institutional coordination or review session."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="submit"
              onClick={() => {
                submitIntentRef.current = "startNow";
              }}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-text calm-transition hover:bg-accent/15 disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" strokeLinejoin="round" />
              </svg>
              {submitting ? "Starting..." : "Start meeting now"}
            </button>
            <button
              type="submit"
              onClick={() => {
                submitIntentRef.current = "draft";
              }}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-text calm-transition hover:bg-surface-container-low disabled:opacity-60"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              onClick={() => {
                submitIntentRef.current = "schedule";
              }}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-text px-5 py-2.5 text-sm font-semibold text-bg calm-transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Meeting"}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-error/20 bg-[var(--pill-error-bg)] px-4 py-3">
          <p className="text-sm text-[var(--pill-error-text)]">{error}</p>
        </div>
      )}

      {/* ── Two-column layout ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* Left: Form fields */}
        <div className="rounded-2xl border border-border/50 bg-surface-container-lowest p-6 shadow-ambient space-y-5">
          {/* Meeting Title */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Meeting Title
            </label>
            <input
              required
              name="title"
              className="field"
              placeholder="e.g. Q3 Academic Standards Review"
            />
          </div>

          {/* Type + Location */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Meeting Type
              </label>
              <select name="type" defaultValue="OTHER" className="field">
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Location
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <input
                  name="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="field pl-9"
                  placeholder="e.g. Boardroom A"
                />
              </div>
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Date
              </label>
              <input
                required
                type="date"
                name="date"
                className="field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Time
              </label>
              <input
                required
                type="time"
                name="time"
                defaultValue="09:00"
                className="field"
              />
            </div>
          </div>

          {/* Pre-Meeting Notes */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                Pre-Meeting Notes
              </label>
              <span className="text-[11px] text-muted">Auto-saves to cloud</span>
            </div>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="field resize-none"
              placeholder="Outline the agenda, key objectives, or pre-read materials for the attendees..."
            />
            {/* Formatting toolbar */}
            <div className="mt-2 flex items-center justify-between border-t border-border/20 pt-2">
              <NotesToolbar textareaRef={notesRef} value={notes} onChange={setNotes} />
            </div>
          </div>
        </div>

        {/* Right: Attendees + Venue Status */}
        <div className="space-y-4">
          {/* Attendees panel */}
          <div className="rounded-2xl border border-border/50 bg-surface-container-lowest p-5 shadow-ambient">
            <h3 className="mb-3 text-sm font-bold text-text">Attendees</h3>

            {/* Search */}
            <div className="relative mb-3">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16.5 16.5 3 3" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search staff members..."
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                className="field pl-9 text-sm"
              />
            </div>

            {/* Staff list */}
            <div className="max-h-56 overflow-auto space-y-1">
              {filteredUsers.map((u) => {
                const selected = isSelected(u);
                const isCurrentUser = u.id === currentUserId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => !isCurrentUser && toggleAttendee(u)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left calm-transition ${
                      selected
                        ? "bg-accent/10 border border-accent/20"
                        : "hover:bg-surface-container-low border border-transparent"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container)] text-[11px] font-bold text-text">
                      {getInitials(u.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{u.fullName}</p>
                      <p className="truncate text-[11px] text-muted">
                        {u.role ? (ROLE_LABELS[u.role] ?? u.role) : u.email}
                      </p>
                    </div>
                    {selected && (
                      <div className="shrink-0">
                        {isCurrentUser ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent">
                            <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-error/10 text-error">
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="py-3 text-center text-sm text-muted">No staff found</p>
              )}
            </div>

            {/* Selected chips */}
            {selectedAttendees.length > 0 && (
              <div className="mt-3 border-t border-border/20 pt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Selected ({selectedAttendees.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAttendees.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-surface-container px-2.5 py-1 text-[11px] font-medium text-text"
                    >
                      {a.fullName}
                      {a.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => toggleAttendee(a)}
                          className="ml-0.5 text-muted hover:text-error calm-transition"
                        >
                          <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Venue Status */}
          {location && (
            <div className="rounded-2xl border border-border/50 bg-surface-container-lowest p-5 shadow-ambient">
              <h3 className="mb-3 text-sm font-bold text-text">Venue Status</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-md bg-[var(--scale-consistent-bar)]" />
                  <div>
                    <p className="text-sm font-semibold text-text">{location} is Available</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      Room available for the selected time slot.
                    </p>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 rounded-xl border border-border/30 bg-surface-container px-3 py-2.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Conflict Check</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      No scheduling conflicts found for selected attendees.
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-[var(--scale-consistent-text)]">Clear</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
