import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { listMeetings, getMeetingStats } from "@/modules/meetings/service";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PastMeetingsList } from "@/components/meetings/PastMeetingsList";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "Starting now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `Starts in ${hrs}h ${remainingMins}m` : `Starts in ${hrs}h`;
}

export default async function MeetingsPage({ searchParams }: { searchParams?: { scope?: string; type?: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");

  const canViewAll = hasPermission(user.role, "meetings:view_all");
  const showAll = canViewAll && searchParams?.scope !== "mine";
  const type = searchParams?.type;

  const [meetings, stats] = await Promise.all([
    listMeetings(user.tenantId, {
      type,
      isAttendee: !showAll,
      userId: user.id,
    }),
    getMeetingStats(user.tenantId, canViewAll ? undefined : user.id),
  ]);

  const now = new Date();
  const upcoming = (meetings as any[])
    .filter((m) => new Date(m.startDateTime) >= now)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  const past = (meetings as any[])
    .filter((m) => new Date(m.startDateTime) < now)
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Meetings"
        titleClassName="text-pretty text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.035em] text-text"
        className="border-b border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] pb-8"
        actions={
          hasPermission(user.role, "meetings:create") ? (
            <Button asChild className="rounded-full px-6 shadow-md">
              <Link href="/meetings/new" className="gap-2">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                </svg>
                New Meeting
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* ── Stats Cards (KPI row — matches Explorer / Signals) ─────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          layout="kpi"
          label="Open Actions"
          value={stats.openActions}
          tone="glass"
          href="/my-actions"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          iconTileClassName="bg-[var(--cat-violet-bg)] text-[var(--cat-violet-text)]"
          valueClassName="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text"
          context={
            stats.newActionsSinceMonday > 0 ? (
              <span className="font-semibold text-[var(--success)]">
                +{stats.newActionsSinceMonday} since Mon
              </span>
            ) : (
              <span className="font-medium text-muted">No new this week</span>
            )
          }
        />
        <StatCard
          layout="kpi"
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          tone="glass"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          iconTileClassName="bg-[var(--status-approved-light)] text-[var(--status-approved-text)]"
          valueClassName="mt-1 text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-text"
          context={<span className="font-medium text-muted">Target 95%</span>}
        />
        <div className="explorer-kpi-tile flex min-h-[140px] flex-col justify-between rounded-2xl p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Next up</p>
          {stats.nextMeeting ? (
            <>
              <p className="mt-2 line-clamp-2 text-base font-bold leading-snug tracking-[-0.02em] text-text">
                {stats.nextMeeting.title}
              </p>
              <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
                {formatTimeUntil(new Date(stats.nextMeeting.startDateTime))}
                {stats.nextMeeting.location ? ` · ${stats.nextMeeting.location}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[0.8125rem] font-medium text-muted">No upcoming meetings</p>
          )}
        </div>
      </div>

      {/* ── Upcoming Meetings ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-lg font-bold tracking-[-0.02em] text-text">Upcoming Meetings</h2>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center">
            <p className="text-sm font-medium text-text">No upcoming meetings</p>
            <p className="mt-1 text-xs text-muted">Create a meeting to start capturing decisions and actions.</p>
          </div>
        ) : (
          <div className="table-shell">
            <p className="sr-only" id="meetings-upcoming-scroll-hint">
              This table scrolls horizontally on small screens.
            </p>
            <div className="overflow-x-auto" aria-describedby="meetings-upcoming-scroll-hint">
              <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Meeting title</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Date &amp; time</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Location</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Organizer</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((m: any) => {
                  const start = new Date(m.startDateTime);
                  const end = new Date(m.endDateTime);
                  const typeLabel = MEETING_TYPE_LABELS[m.type] ?? m.type;
                  const statusLabel = m.status === "CONFIRMED" ? "Confirmed" : m.status === "CANCELLED" ? "Cancelled" : "Pending";
                  const statusVariant = m.status === "CONFIRMED" ? "success" : m.status === "CANCELLED" ? "error" : "warning";

                  return (
                    <tr key={m.id} className="table-row calm-transition">
                      <td className="px-5 py-4">
                        <Link href={`/meetings/${m.id}`} className="link-subtle font-semibold text-text">
                          <p className="font-semibold text-text">{m.title}</p>
                          <p className="text-xs text-muted">{typeLabel}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-text">
                        <p>{start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        <p className="text-xs text-muted">
                          {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {m.location ? (
                          <span className="flex items-center gap-1.5 text-text">
                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-muted">
                              <path fillRule="evenodd" d="M11.536 3.464a5 5 0 010 7.072L8 14.07l-3.536-3.535a5 5 0 117.072-7.072v.001zm-1.414 5.658a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" clipRule="evenodd" />
                            </svg>
                            {m.location}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--secondary-container)] text-xs font-semibold text-text">
                            {getInitials(m.createdBy.fullName)}
                          </div>
                          <span className="text-sm text-text">{m.createdBy.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill variant={statusVariant as any} size="sm">{statusLabel}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Past Meetings ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-lg font-bold tracking-[-0.02em] text-text">Past Meetings</h2>
        <PastMeetingsList meetings={past} />
      </section>
    </div>
  );
}
