"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import styles from "./meeting.module.css";

const MEETING_TYPES = Object.keys(MEETING_TYPE_LABELS) as Array<keyof typeof MEETING_TYPE_LABELS>;
const LENGTHS = [15, 30, 45, 60, 90, 120];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  SLT: "Senior leadership",
  HOD: "Head of department",
  LEADER: "Leader",
  TEACHER: "Teacher",
  HR: "HR",
  ON_CALL: "On call",
};

interface User {
  id: string;
  fullName: string;
  email: string;
  role?: string;
}

type Field = "title" | "date" | "time";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MeetingForm({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("OTHER");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [length, setLength] = useState(60);
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([currentUserId]);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<null | "book" | "start">(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);
  const selectedUsers = users.filter((u) => selected.includes(u.id));

  function toggle(id: string) {
    if (id === currentUserId) return; // the organiser is always in their own meeting
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(mode: "book" | "start") {
    const found: Partial<Record<Field, string>> = {};
    if (!title.trim()) found.title = "Give the meeting a title.";
    let start: Date | null = null;
    if (mode === "book") {
      if (!date) found.date = "Choose a date.";
      if (!time) found.time = "Choose a start time.";
      if (date && time) {
        start = new Date(`${date}T${time}`);
        if (start.getTime() < Date.now() - 60_000) found.date = "That time has already passed. Pick a later one, or start the meeting now.";
      }
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setSubmitting(mode);
    const body: Record<string, unknown> = {
      title: title.trim(),
      type,
      location: location.trim() || undefined,
      notes: agenda.trim() || undefined,
      attendeeIds: selected,
      status: "CONFIRMED",
    };
    if (mode === "start") body.startNow = true;
    else {
      body.startDateTime = start!.toISOString();
      body.endDateTime = new Date(start!.getTime() + length * 60_000).toISOString();
    }

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(typeof data?.error === "string" ? data.error : "The meeting wasn't saved. Try again.");
        setSubmitting(null);
        return;
      }
      const others = selected.length - 1;
      toast(
        mode === "start"
          ? "Meeting started."
          : others > 0
            ? `Meeting booked. Invites sent to ${others} ${others === 1 ? "person" : "people"}.`
            : "Meeting booked.",
        "success",
      );
      router.push(`/meetings/${data.id}`);
    } catch {
      setFormError("Couldn't reach Anaxi, so the meeting wasn't saved. Check your connection and try again.");
      setSubmitting(null);
    }
  }

  return (
    <div className={`${styles.page} space-y-8`}>
      <PageHeader
        variant="ledger"
        title="New meeting"
        subtitle="Choose a time and who's coming. Everyone invited gets an email with the details."
        eyebrow={<Breadcrumb items={[{ label: "Meetings", href: "/meetings" }, { label: "New meeting" }]} />}
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit("book");
        }}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
      >
        <section className={`${styles.card} space-y-5 p-6`} aria-label="Meeting details">
          <label className="block">
            <span className={styles.label}>Title</span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((x) => ({ ...x, title: undefined }));
              }}
              className={styles.input}
              placeholder="e.g. Year 11 mock results review"
              aria-invalid={Boolean(errors.title)}
              autoFocus
            />
            {errors.title ? <span className="mt-1 block text-[13px] text-[var(--pill-error-text)]">{errors.title}</span> : null}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={styles.label}>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={styles.input}>
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MEETING_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={styles.label}>Where (optional)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className={styles.input} placeholder="e.g. Conference room" />
            </label>
          </div>

          <fieldset>
            <legend className={styles.label}>When</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <input
                type="date"
                value={date}
                min={todayLocal()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setErrors((x) => ({ ...x, date: undefined }));
                }}
                className={`${styles.input} col-span-2 sm:col-span-1`}
                aria-label="Date"
                aria-invalid={Boolean(errors.date)}
              />
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setErrors((x) => ({ ...x, time: undefined }));
                }}
                className={styles.input}
                aria-label="Start time"
                aria-invalid={Boolean(errors.time)}
              />
              <select value={length} onChange={(e) => setLength(Number(e.target.value))} className={styles.input} aria-label="Length">
                {LENGTHS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : m === 60 ? "1 hour" : `${m / 60} hours`}
                  </option>
                ))}
              </select>
            </div>
            {errors.date || errors.time ? (
              <span className="mt-1 block text-[13px] text-[var(--pill-error-text)]">{errors.date ?? errors.time}</span>
            ) : null}
          </fieldset>

          <label className="block">
            <span className={styles.label}>Agenda (optional)</span>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={6}
              className={`${styles.input} h-auto min-h-[140px] resize-y py-2.5 leading-relaxed`}
              placeholder="What you'll cover, and anything people should read beforehand. You'll take minutes on the meeting page."
            />
          </label>

          {formError ? (
            <p role="alert" className="rounded-[10px] border border-[var(--pill-error-ring)] bg-[var(--pill-error-bg)] px-3.5 py-2.5 text-[13px] text-[var(--pill-error-text)]">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[#efeff0] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild variant="ghost" className="h-10 min-h-0 px-4">
              <Link href="/meetings">Cancel</Link>
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="secondary" className="h-10 min-h-0 px-5" disabled={submitting !== null} onClick={() => void submit("start")}>
                {submitting === "start" ? "Starting…" : "Start it now instead"}
              </Button>
              <Button type="submit" className="h-10 min-h-0 px-5" disabled={submitting !== null}>
                {submitting === "book" ? "Booking…" : "Book meeting"}
              </Button>
            </div>
          </div>
        </section>

        <section className={`${styles.card} p-5`} aria-labelledby="people-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="people-heading" className="text-[15px] font-semibold">
              People
            </h2>
            <span className="text-[12px] text-[#6e6e73]">{selected.length} invited</span>
          </div>
          {selectedUsers.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e6] px-2.5 py-1 text-[12px]">
                  {u.id === currentUserId ? `${u.fullName} (you)` : u.fullName}
                  {u.id !== currentUserId ? (
                    <button type="button" onClick={() => toggle(u.id)} className="text-[#6e6e73] hover:text-[#1c1c1e]" aria-label={`Remove ${u.fullName}`}>
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find staff"
            aria-label="Find staff to invite"
            className={`${styles.input} mt-3`}
          />
          <ul className="mt-2 max-h-[360px] overflow-auto">
            {filtered.map((u) => {
              const isMe = u.id === currentUserId;
              return (
                <li key={u.id}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-[#f7f7f8] ${isMe ? "cursor-default" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected.includes(u.id)}
                      disabled={isMe}
                      onChange={() => toggle(u.id)}
                      className="h-4 w-4 accent-[#1c1c1e]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]">{isMe ? `${u.fullName} (you)` : u.fullName}</span>
                      <span className="block truncate text-[12px] text-[#6e6e73]">{u.role ? (ROLE_LABELS[u.role] ?? u.role) : u.email}</span>
                    </span>
                  </label>
                </li>
              );
            })}
            {!filtered.length ? <li className="py-4 text-center text-[13px] text-[#6e6e73]">No staff match.</li> : null}
          </ul>
        </section>
      </form>
    </div>
  );
}
