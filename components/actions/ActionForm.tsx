"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, MetaText } from "@/components/ui/typography";

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface ActionFormProps {
  meetingId: string;
  attendees: User[];
  onCreated?: () => void;
  onCancel?: () => void;
}

export function ActionForm({ meetingId, attendees, onCreated, onCancel }: ActionFormProps) {
  const [description, setDescription] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(attendees[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          ownerUserId,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Failed to create action");
        setSubmitting(false);
        return;
      }

      setDescription("");
      setDueDate("");
      onCreated?.();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border/70 bg-surface/95 p-4 shadow-ambient">
      {error && (
        <div className="rounded-xl border border-error/20 bg-[var(--pill-error-bg)] px-3 py-2.5">
          <MetaText className="text-[var(--pill-error-text)]">{error}</MetaText>
        </div>
      )}
      <div>
        <Label htmlFor="action-desc">Description</Label>
        <textarea
          id="action-desc"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="field"
          placeholder="What needs to be done?"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="action-owner">Owner</Label>
          <select
            id="action-owner"
            required
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            className="field"
          >
            <option value="">Select person</option>
            {attendees.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="action-due">Due date</Label>
          <input
            id="action-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="field"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Adding..." : "Add action"}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
