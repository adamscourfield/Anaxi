import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { OnCallStatusBadge } from "@/components/oncall/OnCallStatusBadge";
import { REQUEST_TYPE_LABELS } from "@/modules/oncall/types";

type RequestType = "BEHAVIOUR" | "FIRST_AID";
type Status = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";

export type StudentOnCallEntry = {
  id: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  requestType: RequestType;
  isEmergency: boolean;
  location: string;
  behaviourReasonCategory: string | null;
  notes: string | null;
  status: Status;
  requester: { fullName: string } | null;
  responder: { fullName: string } | null;
};

const DAY = 24 * 60 * 60 * 1000;
const WEEKS = 8;
const TZ = "Europe/London";
const VISIBLE_ENTRIES = 8;

const RAIL: Record<RequestType, string> = {
  BEHAVIOUR: "bg-accent",
  FIRST_AID: "bg-scale-strong-bar",
};

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function monthKey(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: TZ });
}

function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return mins % 60 ? `${hrs}h ${mins % 60}m` : `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function topValue(values: Array<string | null | undefined>): { label: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: { label: string; count: number } | null = null;
  for (const [label, count] of counts) {
    if (!best || count > best.count) best = { label, count };
  }
  return best;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "alert" }) {
  return (
    <div className="min-w-0 bg-[var(--surface-container-lowest)] px-4 py-3.5">
      <p className="anx-label-micro">{label}</p>
      <p
        className={`mt-1.5 truncate text-lg font-bold tabular-nums tracking-[-0.02em] ${
          tone === "alert" ? "text-scale-limited-text" : "text-text"
        }`}
        title={value}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function EntryRow({
  entry,
  studentId,
  showTimings,
}: {
  entry: StudentOnCallEntry;
  studentId: string;
  showTimings: boolean;
}) {
  const cancelled = entry.status === "CANCELLED";
  const title = entry.behaviourReasonCategory?.trim() || REQUEST_TYPE_LABELS[entry.requestType];

  const timings: string[] = [];
  if (showTimings && entry.acknowledgedAt) {
    timings.push(`Responded in ${fmtDuration(entry.acknowledgedAt.getTime() - entry.createdAt.getTime())}`);
  }
  if (showTimings && entry.resolvedAt) {
    timings.push(`Resolved in ${fmtDuration(entry.resolvedAt.getTime() - entry.createdAt.getTime())}`);
  }
  const people: string[] = [];
  if (entry.requester) people.push(`Raised by ${entry.requester.fullName}`);
  if (entry.responder) people.push(`Responder ${entry.responder.fullName}`);

  return (
    <li>
      <Link
        href={`/on-call/${entry.id}?from=${encodeURIComponent(`/students/${studentId}#on-call`)}`}
        className={`group relative grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-start gap-x-4 px-5 py-3.5 calm-transition hover:bg-[var(--surface-container-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)] ${
          cancelled ? "opacity-60" : ""
        }`}
      >
        <span
          aria-hidden
          className={`absolute inset-y-3 left-0 w-[3px] rounded-r-sm ${cancelled ? "bg-surface-container-high" : RAIL[entry.requestType]}`}
        />
        <div className="pt-0.5">
          <p className="text-[13px] font-semibold leading-tight text-text">{fmtDay(entry.createdAt).replace(",", "")}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted">{fmtTime(entry.createdAt)}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-text">{title}</span>
            {entry.isEmergency ? (
              <StatusPill variant="error" size="sm">
                Emergency
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {REQUEST_TYPE_LABELS[entry.requestType]} · {entry.location || "No location"}
          </p>
          {entry.notes?.trim() ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-text/80">{entry.notes.trim()}</p>
          ) : null}
          {people.length > 0 || timings.length > 0 ? (
            <p className="mt-1.5 text-xs text-muted">{[...people, ...timings].join(" · ")}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <OnCallStatusBadge status={entry.status} />
          <span aria-hidden className="text-muted calm-transition group-hover:translate-x-0.5 group-hover:text-text">
            →
          </span>
        </div>
      </Link>
    </li>
  );
}

function Timeline({
  entries,
  studentId,
  showTimings,
}: {
  entries: StudentOnCallEntry[];
  studentId: string;
  showTimings: boolean;
}) {
  const groups: Array<{ month: string; items: StudentOnCallEntry[] }> = [];
  for (const e of entries) {
    const key = monthKey(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.month === key) last.items.push(e);
    else groups.push({ month: key, items: [e] });
  }
  return (
    <div className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)]">
      {groups.map((g) => (
        <section key={g.month}>
          <h3 className="flex items-baseline justify-between bg-[var(--surface-container-low)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            <span>{g.month}</span>
            <span className="tabular-nums">{g.items.length}</span>
          </h3>
          <ul className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)]">
            {g.items.map((e) => (
              <EntryRow key={e.id} entry={e} studentId={studentId} showTimings={showTimings} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function StudentOnCallLog({
  studentId,
  entries,
  canViewTimings,
  label,
  now = new Date(),
}: {
  studentId: string;
  /** Newest first. */
  entries: StudentOnCallEntry[];
  canViewTimings: boolean;
  /** Tenant vocabulary for "On Call(s)" */
  label: { singular: string; plural: string };
  now?: Date;
}) {
  // Cancelled requests are shown but never counted as incidents.
  const counted = entries.filter((e) => e.status !== "CANCELLED");
  const t = now.getTime();

  const last30 = counted.filter((e) => t - e.createdAt.getTime() < 30 * DAY).length;
  const prev30 = counted.filter((e) => {
    const age = t - e.createdAt.getTime();
    return age >= 30 * DAY && age < 60 * DAY;
  }).length;
  const delta = last30 - prev30;

  const emergencies = counted.filter((e) => e.isEmergency).length;
  const topReason = topValue(counted.filter((e) => e.requestType === "BEHAVIOUR").map((e) => e.behaviourReasonCategory));
  const topLocation = topValue(counted.map((e) => e.location));

  const responseTimes = canViewTimings
    ? counted
        .filter((e) => e.acknowledgedAt)
        .map((e) => e.acknowledgedAt!.getTime() - e.createdAt.getTime())
    : [];
  const avgResponse = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  const weekly = Array.from({ length: WEEKS }, () => 0);
  for (const e of counted) {
    const idx = Math.floor((t - e.createdAt.getTime()) / (7 * DAY));
    if (idx >= 0 && idx < WEEKS) weekly[WEEKS - 1 - idx]++;
  }
  const weeklyMax = Math.max(1, ...weekly);
  const weeklyTotal = weekly.reduce((a, b) => a + b, 0);

  const visible = entries.slice(0, VISIBLE_ENTRIES);
  const earlier = entries.slice(VISIBLE_ENTRIES);
  const open = entries.filter((e) => e.status === "OPEN" || e.status === "ACKNOWLEDGED").length;

  return (
    <Card id="on-call" className="scroll-mt-24 !p-0 overflow-hidden">
      <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <SectionHeader
          title={`${label.singular} log`}
          subtitle={
            entries.length === 0
              ? "No requests recorded"
              : open > 0
                ? `${open} still active · ${entries.length} on record`
                : `${entries.length} on record`
          }
          href="/on-call"
          linkLabel={`All ${label.plural.toLowerCase()}`}
        />
      </div>

      {entries.length === 0 ? (
        <div className="border-t border-border px-5 py-10 text-center sm:px-6">
          <p className="text-sm font-semibold text-text">Nothing logged for this student</p>
          <p className="mt-1 text-sm text-muted">
            {label.plural} raised for them will appear here with the reason, location and outcome.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-5">
            <Stat
              label="Last 30 days"
              value={String(last30)}
              hint={
                delta === 0
                  ? `Same as previous 30 days`
                  : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)} vs previous 30 days`
              }
              tone={delta > 0 && last30 >= 3 ? "alert" : undefined}
            />
            <Stat
              label="Emergencies"
              value={String(emergencies)}
              hint={emergencies ? "Flagged by requester" : "None flagged"}
              tone={emergencies > 0 ? "alert" : undefined}
            />
            <Stat
              label="Most common reason"
              value={topReason?.label ?? "—"}
              hint={topReason ? `${topReason.count} of ${counted.length}` : "No behaviour reasons"}
            />
            <Stat
              label="Most common place"
              value={topLocation?.label ?? "—"}
              hint={topLocation ? `${topLocation.count} of ${counted.length}` : undefined}
            />
            {canViewTimings ? (
              <Stat
                label="Avg. response"
                value={avgResponse === null ? "—" : fmtDuration(avgResponse)}
                hint={avgResponse === null ? "No responses yet" : `${responseTimes.length} responded`}
              />
            ) : (
              <Stat label="Behaviour / first aid" value={`${counted.filter((e) => e.requestType === "BEHAVIOUR").length} / ${counted.filter((e) => e.requestType === "FIRST_AID").length}`} />
            )}
          </div>

          <div className="flex items-end justify-between gap-6 border-b border-border px-5 py-4 sm:px-6">
            <div>
              <p className="anx-label-micro">Weekly rhythm</p>
              <p className="mt-1 text-xs text-muted">
                {weeklyTotal} in the last {WEEKS} weeks
              </p>
            </div>
            <div
              className="flex h-12 items-end gap-1.5"
              role="img"
              aria-label={`Weekly counts, oldest to newest: ${weekly.join(", ")}`}
            >
              {weekly.map((n, i) => (
                <div key={i} className="flex h-full w-5 flex-col items-center justify-end gap-1" title={`${n} ${WEEKS - 1 - i === 0 ? "this week" : `${WEEKS - 1 - i}w ago`}`}>
                  <div
                    className={`w-full rounded-[2px] ${n === 0 ? "bg-[var(--surface-container-high)]" : i === WEEKS - 1 ? "bg-accent" : "bg-accent/45"}`}
                    style={{ height: n === 0 ? 2 : `${Math.max(14, (n / weeklyMax) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <Timeline entries={visible} studentId={studentId} showTimings={canViewTimings} />

          {earlier.length > 0 ? (
            <details className="group border-t border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-semibold text-accent calm-transition hover:bg-[var(--surface-container-low)] sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show {earlier.length} earlier {earlier.length === 1 ? "entry" : "entries"}</span>
                <span className="hidden group-open:inline">Hide earlier entries</span>
                <span aria-hidden className="calm-transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="border-t border-border">
                <Timeline entries={earlier} studentId={studentId} showTimings={canViewTimings} />
              </div>
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}
