"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";
import { updateStudentPriorAttainmentAction } from "@/app/(tenant)/students/actions";

type ScoreField = "ks2ReadingScaledScore" | "ks2MathsScaledScore";

export function PriorAttainmentCard({ studentId, reading, maths, canEdit }: {
  studentId: string;
  reading: number | null;
  maths: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ScoreField, string[]>>>({});
  const complete = reading !== null && maths !== null;
  return (
    <section aria-labelledby="prior-attainment-heading" className="rounded-sm border border-border bg-[var(--surface-container-lowest)] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="prior-attainment-heading" className="text-lg font-semibold text-text">KS2 prior attainment</h2>
          <p className="mt-1 text-sm text-muted">Reading and maths scaled scores used by Progress 8.</p>
        </div>
        {canEdit && !editing ? <Button variant="secondary" onClick={() => { setErrors({}); setEditing(true); }}>Edit KS2 scores</Button> : null}
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        {[["Reading", reading], ["Maths", maths], ["Reading and maths average", complete ? (reading + maths) / 2 : null]].map(([label, score]) => (
          <div key={String(label)}><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-text">{score ?? "Not recorded"}</dd></div>
        ))}
      </dl>
      {!complete ? <p className="mt-4 text-sm text-muted">Both scores are needed for the Progress 8 baseline.</p> : null}
      {editing ? (
        <form className="mt-5 space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setPending(true);
          try {
            const result = await updateStudentPriorAttainmentAction(studentId, data);
            if (result.errors) { setErrors(result.errors); return; }
            toast("KS2 scores updated", "success");
            setEditing(false);
            router.refresh();
          } catch {
            toast("Unable to save KS2 scores. Please try again.", "error");
          } finally { setPending(false); }
        }}>
          <p className="text-sm text-muted">Enter whole numbers from 80 to 120. Leave a field blank to clear its score.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {([ ["ks2ReadingScaledScore", "Reading", reading], ["ks2MathsScaledScore", "Maths", maths] ] as const).map(([name, label, value]) => (
              <div className="field" key={name}>
                <label htmlFor={name}>{label} scaled score</label>
                <input id={name} name={name} type="number" min={80} max={120} step={1} defaultValue={value ?? ""} disabled={pending} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} />
                {errors[name] ? <p id={`${name}-error`} className="text-sm text-red-600">Enter a whole number between 80 and 120.</p> : null}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save KS2 scores"}</Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
