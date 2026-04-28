"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MetaText } from "@/components/ui/typography";
import { toast } from "@/components/toast-provider";

interface NotesEditorProps {
  meetingId: string;
  initialNotes: string;
  canEdit: boolean;
  onSave?: (notes: string) => void;
}

export function NotesEditor({ meetingId, initialNotes, canEdit, onSave }: NotesEditorProps) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Failed to save");
        toast(json.error ?? "Failed to save", "error");
        setSaving(false);
        return;
      }
      setNotes(draft);
      setEditing(false);
      onSave?.(draft);
      toast("Notes saved", "success");
    } catch {
      setError("Network error");
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {notes ? (
          <pre className="whitespace-pre-wrap rounded-xl border border-border/50 bg-bg/30 p-4 font-sans text-sm leading-relaxed text-text">{notes}</pre>
        ) : (
          <MetaText>No notes yet.</MetaText>
        )}
        {canEdit && (
          <Button variant="secondary" onClick={() => { setDraft(notes); setEditing(true); }}>
            Edit notes
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-error/20 bg-[var(--pill-error-bg)] px-3 py-2.5">
          <MetaText className="text-[var(--pill-error-text)]">{error}</MetaText>
        </div>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        className="field"
        placeholder="Add meeting notes (Markdown supported)"
      />
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}
