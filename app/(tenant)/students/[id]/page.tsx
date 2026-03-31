import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { H1, H2, MetaText } from "@/components/ui/typography";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUserOrThrow();
  const student = await (prisma as any).student.findFirst({
    where: { id: params.id, tenantId: user.tenantId },
    include: {
      snapshots: { orderBy: { snapshotDate: "asc" } },
      subjectTeachers: {
        where: { OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] },
        include: { subject: true, teacher: { select: { fullName: true, email: true } } },
      },
      changeFlags: { orderBy: { createdAt: "desc" }, take: 50 },
      onCallRequests: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!student) notFound();

  return (
    <div className="space-y-6">
      <div>
        <H1>{student.fullName}</H1>
        <MetaText>UPN {student.upn} · Year {student.yearGroup || "—"} · SEND {student.sendFlag ? "Yes" : "No"} · PP {student.ppFlag ? "Yes" : "No"} · {student.status}</MetaText>
      </div>

      <Card>
        <SectionHeader title="Teachers by subject (current)" />
        <ul className="mt-2 list-disc pl-5 text-sm">
          {(student.subjectTeachers as any[]).map((x: any) => (
            <li key={x.id}>
              {x.subject?.name}: {x.teacher?.fullName ?? "—"}
              {x.teacher?.email ? ` (${x.teacher.email})` : ""}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="p-4 pb-0">
          <SectionHeader title="Trends (snapshot history)" />
        </div>
        <div className="overflow-x-auto p-4 pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/60 text-left text-xs uppercase tracking-[0.05em] text-muted">
                <th className="p-2">Date</th><th className="p-2">Attendance</th><th className="p-2">Detentions</th><th className="p-2">On Calls</th><th className="p-2">Lateness</th>
              </tr>
            </thead>
            <tbody>
              {(student.snapshots as any[]).map((s: any) => (
                <tr key={s.id} className="border-b border-border/70 last:border-0">
                  <td className="p-2">{new Date(s.snapshotDate).toISOString().slice(0,10)}</td>
                  <td className="p-2 text-center">{String(s.attendancePct)}</td>
                  <td className="p-2 text-center">{s.detentionsCount}</td>
                  <td className="p-2 text-center">{s.onCallsCount}</td>
                  <td className="p-2 text-center">{s.latenessCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Flags" />
        <ul className="mt-2 space-y-2 text-sm">
          {(student.changeFlags as any[]).map((f: any) => (
            <li key={f.id} className="flex items-center gap-2">
              <span className="font-medium">{f.flagKey}</span>
              <StatusPill variant={f.severity === "URGENT" ? "error" : f.severity === "PRIORITY" ? "warning" : "neutral"} size="sm">{f.severity}</StatusPill>
              <StatusPill variant={f.resolvedAt ? "success" : "info"} size="sm">{f.resolvedAt ? "Resolved" : "Open"}</StatusPill>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionHeader title="On Call history" />
        <ul className="mt-2 space-y-1 text-sm">
          {(student.onCallRequests as any[]).map((oc: any) => (
            <li key={oc.id}>
              {new Date(oc.createdAt).toISOString().slice(0,10)} · {oc.requestType} · {oc.status} · {oc.location || "—"}{oc.behaviourReasonCategory ? ` · ${oc.behaviourReasonCategory}` : ""}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
