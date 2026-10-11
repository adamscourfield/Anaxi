"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import styles from "@/app/god/god.module.css";
import { useRouter } from "next/navigation";

type School = { id: string; name: string; status: string };

export function GodSchoolSwitcher() {
  const [schools, setSchools] = useState<School[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
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

  async function enterSchool(tenantId: string) {
    setOpen(false);
    setSwitching(true);
    try {
      const ensure = await fetch("/api/god/enter-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!ensure.ok) { setError("School access could not be opened."); return; }
      await update({ targetTenantId: tenantId });
      router.push("/home");
      router.refresh();
    } catch {
      setError("School access could not be opened.");
    } finally {
      setSwitching(false);
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
        {switching ? "Switching..." : "Enter school"}
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
              onClick={() => enterSchool(school.id)}
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
    </div>
  );
}
