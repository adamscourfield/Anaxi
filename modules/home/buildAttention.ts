import type { AttentionItem } from "@/modules/home/attentionItems";
import type { OnCallDetail } from "@/modules/home/hydration";

export function formatRelativeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 120) return `${sec}s ago`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

export function buildLeadershipAttentionItems({
  liveOnCallCount,
  latestLiveOnCall,
  interventionCount,
  interventionDetailLabel,
  attendanceDelta,
  pendingLeaveCount,
  windowDays,
}: {
  liveOnCallCount: number;
  latestLiveOnCall: OnCallDetail | null;
  interventionCount: number;
  interventionDetailLabel: string;
  attendanceDelta: number | null;
  pendingLeaveCount: number;
  windowDays: number;
}): AttentionItem[] {
  return [
    ...(liveOnCallCount > 0
      ? [{
          title: `${liveOnCallCount} on-call escalation${liveOnCallCount === 1 ? "" : "s"}`,
          detail: latestLiveOnCall
            ? `${latestLiveOnCall.requesterName} • ${formatRelativeShort(latestLiveOnCall.createdAt)}`
            : "Open requests in the live queue",
          href: "/on-call",
          tone: "critical" as const,
        }]
      : []),
    ...(interventionCount > 0
      ? [{
          title: `${interventionCount} teacher${interventionCount === 1 ? "" : "s"} require intervention`,
          detail: interventionDetailLabel,
          href: `/analytics?tab=teachers&window=${windowDays}`,
          tone: "critical" as const,
        }]
      : []),
    ...(attendanceDelta !== null && attendanceDelta < 0
      ? [{
          title: "Attendance down",
          detail: `${attendanceDelta.toFixed(1)}% from last week`,
          href: `/analytics?tab=students&window=${windowDays}`,
          tone: "critical" as const,
        }]
      : []),
    ...(pendingLeaveCount > 0
      ? [{
          title: `${pendingLeaveCount} leave approval${pendingLeaveCount === 1 ? "" : "s"} pending`,
          detail: "Cover decisions waiting",
          href: "/leave#pending-requests",
          tone: "warning" as const,
        }]
      : []),
  ];
}

export function buildHodAttentionItems({
  liveOnCallCount,
  latestLiveOnCall,
  pendingLeaveCount,
  urgentStudentCount,
  interventionCount,
  windowDays,
  deptId,
}: {
  liveOnCallCount: number;
  latestLiveOnCall: OnCallDetail | null;
  pendingLeaveCount: number;
  urgentStudentCount: number;
  interventionCount: number;
  windowDays: number;
  deptId: string;
}): AttentionItem[] {
  return [
    ...(liveOnCallCount > 0
      ? [{
          title: `${liveOnCallCount} live on-call escalation${liveOnCallCount === 1 ? "" : "s"}`,
          detail: latestLiveOnCall
            ? `${latestLiveOnCall.requesterName} • ${formatRelativeShort(latestLiveOnCall.createdAt)}`
            : "School-wide queue",
          href: "/on-call",
          tone: "critical" as const,
        }]
      : []),
    ...(interventionCount > 0
      ? [{
          title: `${interventionCount} in your dept need support`,
          detail: "Drift signals in your department",
          href: `/analytics?tab=teachers&window=${windowDays}&department=${deptId}`,
          tone: "critical" as const,
        }]
      : []),
    ...(urgentStudentCount > 0
      ? [{
          title: `${urgentStudentCount} student${urgentStudentCount === 1 ? "" : "s"} urgent or priority`,
          detail: "Pastoral risk in the school",
          href: `/analytics?tab=students&window=${windowDays}`,
          tone: "warning" as const,
        }]
      : []),
    ...(pendingLeaveCount > 0
      ? [{
          title: `${pendingLeaveCount} leave approval${pendingLeaveCount === 1 ? "" : "s"} in your dept`,
          detail: "Awaiting your decision",
          href: "/leave#pending-requests",
          tone: "warning" as const,
        }]
      : []),
  ];
}
