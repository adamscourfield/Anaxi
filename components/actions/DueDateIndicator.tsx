import { calculateDaysUntilDue } from "@/modules/actions/service";

interface DueDateIndicatorProps {
  dueDate: Date | string | null | undefined;
  status: string;
}

export function DueDateIndicator({ dueDate, status }: DueDateIndicatorProps) {
  if (!dueDate) return null;
  const isDone = status === "DONE";
  const days = calculateDaysUntilDue(new Date(dueDate));
  const formatted = new Date(dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  if (isDone) {
    return <span className="text-xs text-muted">Due {formatted}</span>;
  }

  if (days < 0) {
    return (
      <span title={`${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`} className="text-xs font-semibold text-error">
        Overdue ({Math.abs(days)}d)
      </span>
    );
  }

  if (days <= 3) {
    return (
      <span title={`${days} day${days !== 1 ? "s" : ""} remaining`} className="text-xs font-semibold text-[var(--warning-text)]">
        Due {formatted} ({days}d)
      </span>
    );
  }

  return (
    <span title={`${days} days remaining`} className="text-xs text-muted">
      Due {formatted}
    </span>
  );
}
