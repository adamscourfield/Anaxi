import Link from "next/link";
import { Card } from "@/components/ui/card";
import { HomeCardHeadingSm } from "@/components/home/home-chrome";
import { IconCalendar } from "@/components/home/home-chrome";

export function MeetingsTodayList({
  meetings,
}: {
  meetings: { id: string; title: string; startDateTime: Date; location: string | null }[];
}) {
  if (meetings.length === 0) return null;

  return (
    <Card className="space-y-4 !rounded-[14px] !p-6 shadow-none">
      <div className="flex items-center justify-between">
        <HomeCardHeadingSm
          icon={<IconCalendar />}
          title="Meetings today"
          subtitle={`${meetings.length} on your calendar`}
        />
        <Link href="/meetings" className="shrink-0 text-sm font-medium text-text underline decoration-[#d4d4d8] underline-offset-4 calm-transition hover:decoration-[#1c1c1e]">
          View all →
        </Link>
      </div>
      <ul className="space-y-1">
        {meetings.map((m) => (
          <li key={m.id}>
            <Link href={`/meetings/${m.id}`} className="home-row-link flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-medium text-text truncate">{m.title}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {new Date(m.startDateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
