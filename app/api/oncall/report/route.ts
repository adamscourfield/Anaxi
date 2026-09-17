import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { getOpenAndAcknowledgedRequests, getResolvedRequests } from "@/modules/oncall/service";
import { parseResolvedHistoryRange, resolvedHistoryRangeStart, REQUEST_TYPE_LABELS, STATUS_LABELS } from "@/modules/oncall/types";
import { apiErrorResponse } from "@/lib/apiErrors";

function esc(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function fmt(date: unknown): string {
  if (!date) return "";
  return new Date(date as string).toISOString();
}

/** CSV export of the on-call inbox, mirroring what's visible on the on-call page for the same range. */
export async function GET(req: Request) {
  try {
    const user = await getSessionUserOrThrow();
    const canViewResolveTime = hasOnCallPermission(user.role, "oncall:view_resolve_time");

    const { searchParams } = new URL(req.url);
    const range = parseResolvedHistoryRange(searchParams.get("range") ?? undefined);
    const resolvedAfter = resolvedHistoryRangeStart(range, new Date());
    const scope = searchParams.get("scope") === "resolved" ? "resolved" : "all";
    const filters = {
      yearGroup: searchParams.get("yearGroup") || undefined,
      reasonCategory: searchParams.get("reason") || undefined,
    };

    const [openRequests, resolvedRequests] = await Promise.all([
      scope === "all" ? getOpenAndAcknowledgedRequests(user.tenantId, filters) : Promise.resolve([]),
      getResolvedRequests(user.tenantId, resolvedAfter ?? undefined, filters),
    ]);

    const header = [
      "Status",
      "Type",
      "Emergency",
      "Student",
      "Year group",
      "Location",
      "Reason category",
      "Requester",
      "Responder",
      "Notes",
      "Created at",
      ...(canViewResolveTime ? ["Acknowledged at", "Resolved at"] : []),
    ];

    const rows: string[] = [header.map(esc).join(",")];

    for (const r of [...openRequests, ...resolvedRequests] as any[]) {
      const cells = [
        STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status,
        REQUEST_TYPE_LABELS[r.requestType as keyof typeof REQUEST_TYPE_LABELS] ?? r.requestType,
        r.isEmergency ? "Yes" : "No",
        r.student?.fullName ?? "",
        r.student?.yearGroup ?? "",
        r.location ?? "",
        r.behaviourReasonCategory ?? "",
        r.requester?.fullName ?? "",
        r.responder?.fullName ?? "",
        r.notes ?? "",
        fmt(r.createdAt),
        ...(canViewResolveTime ? [fmt(r.acknowledgedAt), fmt(r.resolvedAt)] : []),
      ];
      rows.push(cells.map(esc).join(","));
    }

    const csv = rows.join("\n");
    const filename =
      scope === "resolved"
        ? `on-call-resolved-report_${range}_${new Date().toISOString().slice(0, 10)}.csv`
        : `on-call-report_${range}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
