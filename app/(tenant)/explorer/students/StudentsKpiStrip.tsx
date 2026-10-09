import Link from "next/link";
import { Card } from "@/components/ui/card";
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

function KpiCard({
  label,
  value,
  href,
  hoverClassName = "hover:text-accent",
  meta,
}: {
  label: string;
  value: string;
  href: string;
  hoverClassName?: string;
  meta: React.ReactNode;
}) {
  return (
    <Card className="rounded-sm !p-5 shadow-none">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <Link
        href={href}
        className={`mt-2 block text-[2rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums calm-transition sm:text-[2.25rem] ${hoverClassName}`}
      >
        {value}
      </Link>
      <p className="mt-2 text-[0.8125rem] text-muted">{meta}</p>
    </Card>
  );
}

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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="Cohort"
        value={cohortCount.toLocaleString()}
        href={allHref}
        meta={`${windowDays}-day analysis window`}
      />
      <KpiCard
        label="Avg attendance"
        value={`${avgAttendance.toFixed(1)}%`}
        href={allHref}
        meta="Cohort mean across visible students"
      />
      <KpiCard
        label="Urgent + priority"
        value={String(priorityCount)}
        href={attentionHref}
        hoverClassName="hover:text-[var(--error)]"
        meta={
          <>
            Students in urgent or priority bands ·{" "}
            <Link href={attentionHref} className="font-medium text-accent hover:underline">
              Review queue
            </Link>
          </>
        }
      />
      <KpiCard
        label="Below 80% attendance"
        value={String(lowAttendanceCount)}
        href={lowAttHref}
        meta="With recorded attendance in window"
      />
    </div>
  );
}
