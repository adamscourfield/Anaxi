import Link from "next/link";
import { HomeCardHeadingSm, IconChartBar } from "@/components/home/home-chrome";
import type { GcseAttainmentHeadline, ALevelAttainmentHeadline } from "@/modules/home/hydration";

export type AttainmentPanelProps = {
  gcse: GcseAttainmentHeadline | null;
  aLevel: ALevelAttainmentHeadline | null;
  ctaHref?: string;
};

type StatTone = {
  bg: string;
  text: string;
  bar: string;
};

const TONES = {
  amber: { bg: "bg-scale-some-light", text: "text-scale-some-text", bar: "bg-scale-some" },
  violet: { bg: "bg-cat-violet-bg", text: "text-cat-violet-text", bar: "bg-cat-violet-text" },
  emerald: { bg: "bg-scale-consistent-bg", text: "text-scale-consistent-text", bar: "bg-scale-consistent" },
  blue: {
    bg: "bg-[color-mix(in_srgb,var(--info)_14%,transparent)]",
    text: "text-[var(--info)]",
    bar: "bg-[var(--info)]",
  },
} as const satisfies Record<string, StatTone>;

/** A single stat tile: label, big %, thin progress bar. Used for both the GCSE
 * and A-Level rows so every number on the card reads with the same weight. */
function StatTile({ label, value, tone }: { label: string; value: number | null; tone: StatTone }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[var(--surface-container-lowest)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${tone.bg} ${tone.text}`} aria-hidden>
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold leading-none tracking-[-0.02em] tabular-nums text-text">
        {value === null ? "—" : `${value}%`}
      </p>
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-sm bg-[var(--surface-container-low)]">
        <div className={`h-full rounded-r-full ${tone.bar}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

function ApsTile({ value, entryCount }: { value: number | null; entryCount: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[var(--surface-container-lowest)] p-3.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted">Average point score</p>
      <p className="mt-2 text-2xl font-bold leading-none tracking-[-0.02em] tabular-nums text-text">
        {value === null ? "—" : value.toFixed(1)}
      </p>
      <p className="mt-2.5 text-[11px] text-muted">{entryCount} grade{entryCount !== 1 ? "s" : ""} · 1–9 scale</p>
    </div>
  );
}

function AverageGradeTile({ grade, entryCount }: { grade: string | null; entryCount: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-[var(--surface-container-lowest)] p-3.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted">Average grade</p>
      <p className="mt-2 text-2xl font-bold leading-none tracking-[-0.02em] text-text">
        {grade ?? "—"}
      </p>
      <p className="mt-2.5 text-[11px] text-muted">{entryCount} grade{entryCount !== 1 ? "s" : ""} · A*–U scale</p>
    </div>
  );
}

function GcseRow({ data }: { data: GcseAttainmentHeadline }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-text">
        GCSE <span className="font-normal text-muted">— {data.cycleLabel} · {data.pointLabel}</span>
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="En & Ma 4+" value={data.em4} tone={TONES.amber} />
        <StatTile label="En & Ma 5+" value={data.em5} tone={TONES.violet} />
        <StatTile label="En & Ma 7+" value={data.em7} tone={TONES.emerald} />
        <ApsTile value={data.aps} entryCount={data.apsEntryCount} />
      </div>
    </div>
  );
}

function ALevelRow({ data }: { data: ALevelAttainmentHeadline }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-text">
        A Level <span className="font-normal text-muted">— {data.cycleLabel} · {data.pointLabel}</span>
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="A*–A" value={data.aStarAPct} tone={TONES.emerald} />
        <StatTile label="A*–B" value={data.aStarBPct} tone={TONES.blue} />
        <StatTile label="A*–C" value={data.aStarCPct} tone={TONES.violet} />
        <AverageGradeTile grade={data.averageGrade} entryCount={data.averageGradeEntryCount} />
      </div>
    </div>
  );
}

export function AttainmentPanel({ gcse, aLevel, ctaHref = "/assessments" }: AttainmentPanelProps) {
  const subtitle = [gcse ? "GCSE" : null, aLevel ? "A Level" : null].filter(Boolean).join(" · ") || "No results recorded yet";

  return (
    <div className="flex h-full flex-col gap-5">
      <HomeCardHeadingSm
        icon={<IconChartBar className="text-[var(--brand-blue)]" />}
        title="Attainment"
        subtitle={subtitle}
        end={
          <Link href={ctaHref} className="link-accent shrink-0 text-xs font-semibold">
            View all →
          </Link>
        }
      />

      {gcse || aLevel ? (
        <div className="space-y-5">
          {gcse && <GcseRow data={gcse} />}
          {aLevel && <ALevelRow data={aLevel} />}
        </div>
      ) : (
        <p className="text-sm text-muted">No GCSE or A-Level results recorded yet this cycle.</p>
      )}

      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-text calm-transition hover:text-muted"
      >
        Open assessments →
      </Link>
    </div>
  );
}
