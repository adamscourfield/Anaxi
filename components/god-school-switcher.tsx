"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useSession } from "next-auth/react";
import styles from "@/app/god/god.module.css";
import { useRouter } from "next/navigation";
import { SchoolSwitchProgress, type SchoolSwitchStage } from "@/components/school-switch-progress";

type School = { id: string; name: string; status: string };

export function GodSchoolSwitcher() {
  const [schools, setSchools] = useState<School[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  // `null` when idle; otherwise the school being entered and how far the switch has got.
  const [progress, setProgress] = useState<{
    schoolName: string;
    stage: SchoolSwitchStage;
    failedStage?: SchoolSwitchStage;
  } | null>(null);
  const [navigating, startNavigation] = useTransition();
  const switching = progress !== null;
  const ref = useRef<HTMLDivElement>(null);
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/god/schools")
      .then((r) => { if (!r.ok) throw new Error("Schools could not be loaded"); return r.json(); })
      .then((data) => setSchools(data.schools ?? []))
      .catch(() => setError("Schools could not be loaded."))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // The last stage ends when the school's home page has actually rendered.
  useEffect(() => {
    if (progress?.stage !== "loading" || navigating) return;
    setProgress((p) => (p ? { ...p, stage: "done" } : p));
  }, [progress?.stage, navigating]);

  // Show the finished state briefly, then get out of the way.
  useEffect(() => {
    if (progress?.stage !== "done") return;
    const t = window.setTimeout(() => setProgress(null), 700);
    return () => window.clearTimeout(t);
  }, [progress?.stage]);

  async function enterSchool(tenantId: string, schoolName: string) {
    setOpen(false);
    setError("");
    let stage: SchoolSwitchStage = "access";
    setProgress({ schoolName, stage });
    const fail = () => setProgress({ schoolName, stage: "error", failedStage: stage });
    try {
      const ensure = await fetch("/api/god/enter-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!ensure.ok) return fail();

      stage = "session";
      setProgress({ schoolName, stage });
      await update({ targetTenantId: tenantId });

      stage = "loading";
      startNavigation(() => {
        router.push("/home");
        router.refresh();
      });
      setProgress({ schoolName, stage });
    } catch {
      fail();
    }
  }

  return (
    <div ref={ref} className="relative" onKeyDown={event=>{if(event.key==="Escape"){setOpen(false);ref.current?.querySelector("button")?.focus();}}}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(""); }}
        aria-expanded={open}
        aria-controls={open ? "god-school-picker" : undefined}
        disabled={switching}
        className={styles.schoolTrigger}
        style={{ color: "var(--on-surface-variant)" }}
      >
        Enter school
        <svg viewBox="0 0 16 16" fill="none" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!open && error && <span role="alert" className="text-xs text-error">{error}</span>}
      {open && (
        <div id="god-school-picker" className={styles.schoolPicker}>
          <input type="search" autoFocus aria-label="Find a school to enter" placeholder="Find a school…" value={query} onChange={e=>setQuery(e.target.value)}/>
          {!loaded && <p>Loading schools…</p>}
          {error && <p role="alert">{error}</p>}
          {loaded && !error && !schools.some(s=>s.name.toLowerCase().includes(query.toLowerCase())) && <p>No matching schools.</p>}
          {schools.filter(s=>s.name.toLowerCase().includes(query.toLowerCase())).map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => enterSchool(school.id, school.name)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text transition-colors hover:bg-bg"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-[11px] font-semibold text-[#e14e36]">
                {school.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{school.name}</span>
              {school.status !== "ACTIVE" && (
                <span className="text-[10px] text-muted uppercase">{school.status}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {progress ? (
        <SchoolSwitchProgress
          schoolName={progress.schoolName}
          stage={progress.stage}
          failedStage={progress.failedStage}
          errorMessage="School access could not be opened. You are still in the console."
          onClose={() => setProgress(null)}
        />
      ) : null}
    </div>
  );
}
