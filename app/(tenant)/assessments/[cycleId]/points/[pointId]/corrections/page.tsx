"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { H3, MetaText } from "@/components/ui/typography";

type Result = { id: string; rawValue: string; arborRawValue: string | null; isManuallyOverridden: boolean; manualOverrideAt: string | null; assessment: { id: string; subject: string; gradeFormat: string }; student: { id: string; fullName: string; yearGroup: string | null } };
type Assessment = { id: string; subject: string; gradeFormat: string; results: Result[] };
type Student = { id: string; fullName: string; yearGroup: string | null };
type Data = { point: { label: string; resultStatus: string }; assessments: Assessment[]; students: Student[] };

export default function ArborCorrectionsPage() {
  const { cycleId, pointId } = useParams<{ cycleId: string; pointId: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [newAssessmentId, setNewAssessmentId] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newValue, setNewValue] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/assessments/points/${pointId}/arbor-results`);
    if (!response.ok) { setMessage("The Arbor correction register could not be loaded."); return; }
    const next = await response.json() as Data;
    setData(next);
    setNewAssessmentId((current) => current || next.assessments[0]?.id || "");
  }, [pointId]);
  useEffect(() => { void load(); }, [load]);

  const request = async (method: "PATCH" | "POST" | "DELETE", body: Record<string, string>) => {
    const response = await fetch(`/api/assessments/points/${pointId}/arbor-results`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The correction could not be saved.");
  };
  const save = async (result: Result) => {
    const rawValue = (edits[result.id] ?? result.rawValue).trim();
    if (!rawValue || rawValue === result.rawValue) return;
    setSaving(result.id); setMessage(null);
    try { await request("PATCH", { resultId: result.id, rawValue }); await load(); setEdits((current) => { const next = { ...current }; delete next[result.id]; return next; }); setMessage("Correction saved. Arbor will no longer overwrite this result."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The correction could not be saved."); }
    finally { setSaving(null); }
  };
  const remove = async (result: Result) => {
    setSaving(result.id); setMessage(null);
    try { await request("DELETE", { resultId: result.id }); await load(); setMessage("The Anaxi correction was removed. Arbor is authoritative again."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The correction could not be removed."); }
    finally { setSaving(null); }
  };
  const addMissing = async () => {
    if (!newAssessmentId || !newStudentId || !newValue.trim()) { setMessage("Choose a subject, student, and grade first."); return; }
    setSaving("new"); setMessage(null);
    try { await request("POST", { assessmentId: newAssessmentId, studentId: newStudentId, rawValue: newValue.trim() }); await load(); setNewStudentId(""); setNewValue(""); setMessage("Missing grade added as an Anaxi correction. Arbor will not overwrite it."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The grade could not be added."); }
    finally { setSaving(null); }
  };

  const results = data?.assessments.flatMap((assessment) => assessment.results.map((result) => ({ ...result, assessment: { id: assessment.id, subject: assessment.subject, gradeFormat: assessment.gradeFormat } }))) ?? [];
  return (
    <AttainmentPageShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <AssessmentsBreadcrumb items={[{ label: "Attainment", href: "/assessments" }, { label: "Cycle", href: `/assessments/${cycleId}` }, { label: data?.point.label ?? "Result point", href: `/assessments/${cycleId}/points/${pointId}` }, { label: "Arbor corrections" }]} />
        <PageHeader eyebrow="Attainment · Arbor" title="Correct Arbor marks" subtitle="Use this register for a missing or incorrect Arbor result. Anaxi keeps the last value received from Arbor and protects your correction from future syncs." actions={<Link href={`/assessments/${cycleId}/points/${pointId}`}><Button variant="secondary">Back to results</Button></Link>} />

        {message ? <Card className="border-accent/30"><MetaText>{message}</MetaText></Card> : null}
        {!data ? <Card><MetaText>Loading Arbor results…</MetaText></Card> : data.point.resultStatus === "LOCKED" ? <Card><H3>This result point is locked</H3><MetaText className="mt-1">Unlock it before recording an Anaxi correction.</MetaText></Card> : (
          <>
            <Card className="space-y-3">
              <SectionHeader title="Add a missing grade" subtitle="This creates an Anaxi override in an existing Arbor subject. It will remain visible until you remove the override." />
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_10rem_auto] md:items-end">
                <label className="space-y-1 text-sm font-medium">Subject<select className="field w-full" value={newAssessmentId} onChange={(event) => setNewAssessmentId(event.target.value)}>{data.assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.subject} ({assessment.gradeFormat})</option>)}</select></label>
                <label className="space-y-1 text-sm font-medium">Student<select className="field w-full" value={newStudentId} onChange={(event) => setNewStudentId(event.target.value)}><option value="">Choose student</option>{data.students.map((student) => <option key={student.id} value={student.id}>{student.fullName}{student.yearGroup ? ` · ${student.yearGroup}` : ""}</option>)}</select></label>
                <label className="space-y-1 text-sm font-medium">Grade<input className="field w-full" value={newValue} onChange={(event) => setNewValue(event.target.value)} /></label>
                <Button onClick={addMissing} disabled={saving === "new"}>{saving === "new" ? "Adding…" : "Add grade"}</Button>
              </div>
            </Card>

            <Card className="space-y-3">
              <SectionHeader title="Imported Arbor marks" subtitle="Edit a value only when Arbor is missing it or it is known to be incorrect. The saved Arbor value remains visible for comparison." />
              <div className="overflow-x-auto rounded-sm border border-border/70">
                <table className="w-full min-w-[52rem] text-left text-sm"><thead className="bg-[var(--surface-container-low)] text-xs uppercase tracking-[0.1em] text-muted"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Arbor value</th><th className="px-4 py-3">Anaxi value</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-border/70">
                  {results.map((result) => <tr key={result.id}><td className="px-4 py-3 font-medium">{result.student.fullName}</td><td className="px-4 py-3">{result.assessment.subject}</td><td className="px-4 py-3">{result.arborRawValue ?? "Not supplied by Arbor"}</td><td className="px-4 py-3"><input className="field h-9 w-28" value={edits[result.id] ?? result.rawValue} onChange={(event) => setEdits((current) => ({ ...current, [result.id]: event.target.value }))} />{result.isManuallyOverridden ? <div className="mt-1 text-xs font-semibold text-accent">Anaxi override</div> : null}</td><td className="px-4 py-3"><div className="flex gap-2"><Button variant="secondary" className="px-3" onClick={() => save(result)} disabled={saving === result.id}>Save</Button>{result.isManuallyOverridden ? <Button variant="ghost" className="px-3" onClick={() => remove(result)} disabled={saving === result.id}>Use Arbor</Button> : null}</div></td></tr>)}
                </tbody></table>
              </div>
            </Card>
          </>
        )}
      </div>
    </AttainmentPageShell>
  );
}
