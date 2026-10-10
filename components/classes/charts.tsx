"use client";
import type { ReactNode } from "react";

export function BarChart({ title, subtitle, rows, color = "var(--primary)", suffix = "", max, controls, onSelect }: {
  title: string; subtitle: string; rows: { label: string; value: number }[]; color?: string; suffix?: string; max?: number; controls?: ReactNode; onSelect?: (label: string) => void;
}) {
  const ceiling = max ?? Math.max(1, ...rows.map(row => row.value));
  return <section className="class-panel p-5 sm:p-6" aria-label={title}>
    <h2 className="text-base font-semibold text-text">{title}</h2>
    <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>
    {controls ? <div className="mt-4">{controls}</div> : null}
    {rows.length ? <ul className="mt-6 space-y-4">{rows.map(row => <li key={row.label}><button type="button" className="w-full rounded-lg p-1 text-left transition-colors hover:bg-surface-container-high focus-visible:outline-accent" onClick={() => onSelect?.(row.label)} aria-label={`${row.label}: ${row.value}. Show pupils`}>
      <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="text-muted">{row.label}</span><span className="font-semibold tabular-nums text-text">{Number.isInteger(row.value) ? row.value : row.value.toFixed(1)}{suffix}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true"><div className="class-chart-bar h-full rounded-full" style={{ width: `${Math.min(100, row.value / ceiling * 100)}%`, background: color }} /></div>
    </button></li>)}</ul> : <p className="py-12 text-center text-sm text-muted">No recorded data yet.</p>}
  </section>;
}

export function AttendanceRing({ bands, missing, onSelect }: { bands: { label: string; value: number; color: string }[]; missing: number; onSelect?: (label: string) => void }) {
  const total = bands.reduce((sum, band) => sum + band.value, 0);
  let offset = 0;
  return <section className="class-panel p-5 sm:p-6" aria-label="Pupil attendance distribution">
    <h2 className="text-base font-semibold text-text">Attendance profile</h2>
    <p className="mt-1 text-xs text-muted">Latest overall attendance for each pupil</p>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-7">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--surface-container-high)" strokeWidth="11" />
          {bands.map(band => { const fraction = total ? band.value / total : 0; const start = offset; offset += fraction; return <circle key={band.label} cx="60" cy="60" r="48" fill="none" stroke={band.color} strokeWidth="11" pathLength="100" strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`} strokeDashoffset={-start * 100} onClick={() => onSelect?.(band.label)} style={{ cursor: "pointer" }} className="class-chart-ring" />; })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold tabular-nums tracking-tight">{total}</span><span className="mt-1 text-xs text-muted">with data</span></div>
      </div>
      <ul className="min-w-[150px] space-y-3 text-xs">{bands.map(band => <li key={band.label} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: band.color }} /><button type="button" className="flex-1 text-left text-muted hover:underline" onClick={() => onSelect?.(band.label)}>{band.label}</button><strong className="tabular-nums">{band.value}</strong></li>)}<li className="flex justify-between gap-4 border-t border-border pt-3 text-muted"><button type="button" onClick={() => onSelect?.("No attendance data")}>No attendance data</button><strong>{missing}</strong></li></ul>
    </div>
  </section>;
}
