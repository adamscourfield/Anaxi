import { STATUS_LABELS } from "@/modules/oncall/types";
import { StatusPill, PillVariant } from "@/components/ui/status-pill";

type OnCallStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";

const STATUS_VARIANT: Record<OnCallStatus, PillVariant> = {
  OPEN: "error",
  ACKNOWLEDGED: "warning",
  RESOLVED: "success",
  CANCELLED: "neutral",
};

export function OnCallStatusBadge({
  status,
  className = "",
}: {
  status: OnCallStatus;
  /** Extra classes merged onto the pill (e.g. design-system overrides). */
  className?: string;
}) {
  return (
    <StatusPill variant={STATUS_VARIANT[status] ?? "neutral"} size="sm" className={className}>
      {STATUS_LABELS[status]}
    </StatusPill>
  );
}
