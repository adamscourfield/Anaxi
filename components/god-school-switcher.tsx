"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type School = { id: string; name: string; status: string };

export function GodSchoolSwitcher() {
  const [schools, setSchools] = useState<School[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/god/schools")
      .then((r) => r.json())
      .then((data) => setSchools(data.schools ?? []));
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
      if (!ensure.ok) return;
      await update({ targetTenantId: tenantId });
      router.push("/home");
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-surface-container disabled:opacity-60"
        style={{ color: "var(--on-surface-variant)" }}
      >
        {switching ? "Switching..." : "Enter school"}
        <svg viewBox="0 0 16 16" fill="none" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && schools.length > 0 && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-border bg-surface-container-lowest py-1 shadow-lg">
          {schools.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => enterSchool(school.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text transition-colors hover:bg-bg"
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold bg-accentSurface text-accent">
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
