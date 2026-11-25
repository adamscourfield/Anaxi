import Link from "next/link";
import styles from "./page.module.css";
import listStyles from "@/components/meetings/meetings.module.css";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getMyMeetingSummary, listMeetingsForPage } from "@/modules/meetings/service";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/types";
import { formatMeetingSlot } from "@/modules/meetings/format";
import { startOfDayInZone } from "@/modules/oncall/time";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingsFilters } from "@/components/meetings/MeetingsFilters";
import { MeetingRows, type MeetingRow } from "@/components/meetings/MeetingRows";

const PAST_LIMIT = 60;

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ scope?: string; type?: string }>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");
  const resolvedSearchParams = await searchParams;

  const canViewAll = hasPermission(user.role, "meetings:view_all");
  const canCreate = hasPermission(user.role, "meetings:create");
  const scope = canViewAll && resolvedSearchParams?.scope !== "mine" ? "all" : "mine";
  const validTypes = Object.keys(MEETING_TYPE_LABELS);
  const type = resolvedSearchParams?.type && validTypes.includes(resolvedSearchParams.type) ? resolvedSearchParams.type : undefined;

  // Preserve the list's filter state so "Back" from a meeting returns to the same view.
  const currentQuery = new URLSearchParams();
  if (canViewAll && scope === "mine") currentQuery.set("scope", "mine");
  if (type) currentQuery.set("type", type);
  const qs = currentQuery.toString();
  const from = encodeURIComponent(`/meetings${qs ? `?${qs}` : ""}`);

  const now = new Date();
  const todayStart = startOfDayInZone(now);
  const [lists, mine] = await Promise.all([
    listMeetingsForPage(user.tenantId, { type, attendeeUserId: scope === "mine" ? user.id : undefined, todayStart, pastLimit: PAST_LIMIT }),
    getMyMeetingSummary(user.tenantId, user.id, now, todayStart),
  ]);

  const toRows = (rows: any[]): MeetingRow[] =>
    rows.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      status: m.status,
      startDateTime: new Date(m.startDateTime).toISOString(),
      endDateTime: new Date(m.endDateTime).toISOString(),
      startedAt: m.startedAt ? new Date(m.startedAt).toISOString() : null,
      endedAt: m.endedAt ? new Date(m.endedAt).toISOString() : null,
      location: m.location ?? null,
      createdBy: m.createdBy,
      _count: m._count,
    }));
  const filtered = Boolean(type) || (canViewAll && scope === "mine");
  const next = mine.nextMeeting;

  return (
    <div className={`${styles.page} space-y-10`}>
      <PageHeader
        variant="ledger"
        title="Meetings"
        subtitle="Plan agendas, take minutes and agree actions, then follow them up."
        actions={
          canCreate ? (
            <Button asChild className="h-10 min-h-0 gap-2 px-5">
              <Link href="/meetings/new">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New meeting
              </Link>
            </Button>
          ) : undefined
        }
      />

      <section className={listStyles.stats} aria-label="Your meetings at a glance">
        <Link href="/my-actions" className={listStyles.stat}>
          <p className="text-[12px] font-medium text-[#6e6e73]">Your open actions</p>
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{mine.openActions}</p>
          <p className="mt-2 text-[12px] text-[#6e6e73]">
            {mine.overdueActions > 0 ? (
              <span className="font-medium text-[var(--pill-error-text)]">{mine.overdueActions} overdue</span>
            ) : mine.openActions > 0 ? (
              "None overdue"
            ) : (
              "Nothing waiting on you"
            )}
          </p>
        </Link>
        {next ? (
          <Link href={`/meetings/${next.id}?from=${from}`} className={listStyles.stat}>
            <p className="text-[12px] font-medium text-[#6e6e73]">{next.startedAt ? "Happening now" : "Your next meeting"}</p>
            <p className="mt-1.5 truncate text-[20px] font-semibold leading-tight tracking-[-0.01em]">{next.title}</p>
            <p className="mt-2 text-[12px] text-[#6e6e73]">
              {formatMeetingSlot(next.startDateTime, null, now)}
              {next.location ? ` · ${next.location}` : ""}
            </p>
          </Link>
        ) : (
          <div className={listStyles.stat}>
            <p className="text-[12px] font-medium text-[#6e6e73]">Your next meeting</p>
            <p className="mt-1.5 text-[20px] font-semibold leading-tight text-[#a1a1aa]">None booked</p>
            <p className="mt-2 text-[12px] text-[#6e6e73]">Meetings you&rsquo;re invited to appear here.</p>
          </div>
        )}
      </section>

      <MeetingsFilters canViewAll={canViewAll} scope={scope} type={type} />

      {lists.inProgress.length ? (
        <section aria-labelledby="meetings-live" className="space-y-3">
          <h2 id="meetings-live" className="text-[17px] font-semibold tracking-[-0.01em]">
            Happening now
          </h2>
          <MeetingRows meetings={toRows(lists.inProgress)} from={from} variant="live" todayStart={todayStart.toISOString()} />
        </section>
      ) : null}

      <section aria-labelledby="meetings-upcoming" className="space-y-3">
        <h2 id="meetings-upcoming" className="text-[17px] font-semibold tracking-[-0.01em]">
          Coming up
        </h2>
        {lists.upcoming.length ? (
          <MeetingRows meetings={toRows(lists.upcoming)} from={from} variant="upcoming" todayStart={todayStart.toISOString()} />
        ) : (
          <EmptyState
            mode="embedded"
            title={filtered ? "Nothing coming up that matches" : "Nothing booked"}
            description={filtered ? "Try another type, or clear the filters." : "New meetings you organise or are invited to appear here."}
            action={
              canCreate && !filtered ? (
                <Button asChild variant="secondary">
                  <Link href="/meetings/new">Plan a meeting</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </section>

      <section aria-labelledby="meetings-past" className="space-y-3">
        <h2 id="meetings-past" className="text-[17px] font-semibold tracking-[-0.01em]">
          Past
        </h2>
        {lists.past.length ? (
          <MeetingRows meetings={toRows(lists.past)} from={from} variant="past" todayStart={todayStart.toISOString()} pageSize={10} total={lists.pastTotal} />
        ) : (
          <EmptyState mode="embedded" title="No past meetings" description="Meetings move here once they've ended, with their minutes and actions." />
        )}
      </section>
    </div>
  );
}
