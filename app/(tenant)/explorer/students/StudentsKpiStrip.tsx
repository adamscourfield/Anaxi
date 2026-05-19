import Link from "next/link";
import {
  buildStudentsListUrl,
  type StudentsUrlParams,
} from "@/modules/students/explorerList";

type Props = {
  basePath: string;
  urlBase: StudentsUrlParams;
  cohortCount: number;
  avgAttendance: number;
  priorityCount: number;
  lowAttendanceCount: number;
  windowDays: number;
};

export function StudentsKpiStrip({
  basePath,
  urlBase,
  cohortCount,
  avgAttendance,
  priorityCount,
  lowAttendanceCount,
  windowDays,
}: Props) {
  const attentionHref = buildStudentsListUrl(basePath, {
    ...urlBase,
    view: "attention",
    band: undefined,
    page: undefined,
    attendanceBelow: undefined,
  });
  const allHref = buildStudentsListUrl(basePath, {
    ...urlBase,
    view: "all",
    band: undefined,
    page: undefined,
    attendanceBelow: undefined,
  });
  const lowAttHref = buildStudentsListUrl(basePath, {
    ...urlBase,
    view: "all",
    band: undefined,
    attendanceBelow: "1",
    page: undefined,
  });

  return (
    <div className="explorer-kpi-tile rounded-2xl p-6 sm:p-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)]">
        <div className="lg:pr-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            Cohort
          </p>
          <Link
            href={allHref}
            className="mt-2 block text-[2.75rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums calm-transition hover:text-accent sm:text-[3.25rem]"
          >
            {cohortCount.toLocaleString()}
          </Link>
          <p className="mt-2 text-[0.8125rem] text-muted">
            {windowDays}-day analysis window
          </p>
        </div>
        <div className="sm:pl-0 lg:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            Avg attendance
          </p>
          <p className="mt-2 text-[2.125rem] font-bold tabular-nums tracking-[-0.03em] text-text sm:text-[2.25rem]">
            {avgAttendance.toFixed(1)}%
          </p>
          <p className="mt-2 text-[0.8125rem] text-muted">
            Cohort mean across visible students
          </p>
        </div>
        <div className="sm:pl-0 lg:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            Urgent + priority
          </p>
          <Link
            href={attentionHref}
            className="mt-2 block text-[2.125rem] font-bold tabular-nums tracking-[-0.03em] text-text calm-transition hover:text-[var(--error)] sm:text-[2.25rem]"
          >
            {priorityCount}
          </Link>
          <p className="mt-2 text-[0.8125rem] text-muted">
            Students in urgent or priority bands ·{" "}
            <Link href={attentionHref} className="font-medium text-accent hover:underline">
              Review queue
            </Link>
          </p>
        </div>
        <div className="sm:pl-0 lg:pl-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            Below 80% attendance
          </p>
          <Link
            href={lowAttHref}
            className="mt-2 block text-[2.125rem] font-bold tabular-nums tracking-[-0.03em] text-text calm-transition hover:text-accent sm:text-[2.25rem]"
          >
            {lowAttendanceCount}
          </Link>
          <p className="mt-2 text-[0.8125rem] text-muted">
            With recorded attendance in window
          </p>
        </div>
      </div>
    </div>
  );
}
