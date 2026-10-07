"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";

type Assessment = { id: string; subject: string };

export function AssessmentRenameControl({ assessments }: { assessments: Assessment[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(assessments.map((assessment) => [assessment.id, assessment.subject])));
  const [saving, setSaving] = useState<string | null>(null);

  async function save(assessment: Assessment) {
    setSaving(assessment.id);
    try {
      const response = await fetch(`/api/assessments/subjects/${assessment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: names[assessment.id] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || "Could not rename assessment", "error");
        return;
      }
      toast("Assessment renamed", "success");
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  if (!assessments.length) return null;
  return (
    <div className="w-full sm:w-auto">
      <Button type="button" variant="ghost" onClick={() => setOpen((value) => !value)}>{open ? "Close subject names" : "Rename subjects"}</Button>
      {open ? (
        <div className="mt-3 space-y-2 rounded-sm border border-border bg-[var(--surface-container-lowest)] p-3 text-left shadow-sm">
          <p className="text-xs text-muted">These names are used throughout Anaxi Attainment. Arbor imports keep the names you set here.</p>
          {assessments.map((assessment) => (
            <div key={assessment.id} className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`assessment-name-${assessment.id}`}>Assessment name</label>
              <input
                id={`assessment-name-${assessment.id}`}
                value={names[assessment.id] ?? ""}
                maxLength={120}
                onChange={(event) => setNames((current) => ({ ...current, [assessment.id]: event.target.value }))}
                className="h-9 min-w-56 flex-1 rounded-sm border border-border bg-[var(--surface-container-low)] px-3 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <Button type="button" variant="secondary" disabled={saving !== null || names[assessment.id] === assessment.subject} onClick={() => void save(assessment)}>{saving === assessment.id ? "Saving..." : "Save"}</Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
