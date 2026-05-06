"use client";

import { useState } from "react";

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface AttendeeSelectorProps {
  users: User[];
  selected: User[];
  lockedIds?: string[];
  onChange: (selected: User[]) => void;
}

export function AttendeeSelector({ users, selected, lockedIds = [], onChange }: AttendeeSelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = users.filter(
    (u) =>
      (u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())) &&
      !selected.some((s) => s.id === u.id)
  );

  function add(user: User) {
    onChange([...selected, user]);
  }

  function remove(userId: string) {
    onChange(selected.filter((u) => u.id !== userId));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selected.map((u) => (
          <span key={u.id} className="flex items-center gap-1.5 rounded-md border border-border/60 bg-divider/60 px-3 py-1 text-xs font-medium text-text">
            {u.fullName}
            {!lockedIds.includes(u.id) && (
              <button type="button" onClick={() => remove(u.id)} className="calm-transition text-muted hover:text-error" aria-label={`Remove ${u.fullName}`}>
                <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            )}
          </span>
        ))}
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search people..."
        className="field"
      />
      <div className="max-h-48 overflow-auto rounded-xl border border-border/60 bg-bg/40">
        {filtered.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => add(u)}
            className="calm-transition w-full px-3 py-2.5 text-left text-sm text-text hover:bg-divider/50"
          >
            {u.fullName} <span className="text-xs text-muted">{u.email}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="p-3 text-xs text-muted">No more people to add</p>}
      </div>
    </div>
  );
}
