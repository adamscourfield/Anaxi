import Link from "next/link";
import type { ResultStatus } from "@prisma/client";

const STATUS_HINT: Partial<Record<ResultStatus, string>> = {
  DRAFT: "Draft — data can be edited via CSV re-import.",
  VALIDATED: "Validated — ready for leadership review.",
  PUBLISHED: "Published — visible for school reporting.",
  LOCKED: "Locked — uploads are disabled. Unlock from the cycle page to re-import CSV.",
};

type Props = {
  status: ResultStatus;
  cycleId: string;
  className?: string;
};

export function LockedPointBanner({ status, cycleId, className = "" }: Props) {
  if (status !== "LOCKED") return null;

  return (
    <div
      role="status"
      className={`flex flex-col gap-2 rounded-sm border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
    >
      <p className="text-sm text-text">
        <span className="font-semibold">This result point is locked.</span>{" "}
        {STATUS_HINT.LOCKED}
      </p>
      <Link
        href={`/assessments/${cycleId}`}
        className="link-accent shrink-0 text-sm font-semibold underline-offset-2"
      >
        Manage status on cycle →
      </Link>
    </div>
  );
}

export function ResultStatusHint({ status }: { status: ResultStatus }) {
  const hint = STATUS_HINT[status];
  if (!hint) return null;
  return (
    <p className="text-xs text-muted" title={hint}>
      {hint}
    </p>
  );
}
