import Link from "next/link";
import {
  buildStudentsListUrl,
  type StudentsUrlParams,
} from "@/modules/students/explorerList";

type Props = {
  basePath: string;
  urlBase: StudentsUrlParams;
  priorityCount: number;
  windowDays: number;
  computedAt: Date;
};

export function StudentsCriticalBanner({
  basePath,
  urlBase,
  priorityCount,
  windowDays,
  computedAt,
}: Props) {
  if (priorityCount === 0) return null;

  const reviewHref = buildStudentsListUrl(basePath, {
    ...urlBase,
    view: "attention",
    band: undefined,
    page: undefined,
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--scale-limited-bar)_28%,transparent)] bg-[color-mix(in_srgb,var(--scale-limited-light)_55%,var(--surface-container-lowest))] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pill-error-bg)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--error)]" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-text">
            {priorityCount} student{priorityCount !== 1 ? "s" : ""} need attention
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            Urgent or priority pastoral risk in the last {windowDays} days. Data updated{" "}
            {computedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} on{" "}
            {computedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
          </p>
        </div>
      </div>
      <Link
        href={reviewHref}
        className="anx-btn-pill-primary shrink-0 self-start calm-transition sm:self-center"
      >
        Review queue
      </Link>
    </div>
  );
}
