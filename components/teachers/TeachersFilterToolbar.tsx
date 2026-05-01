import Link from "next/link";
import type { ReactNode } from "react";

const VALID_WINDOWS = [7, 21, 28, 90] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

type DepartmentOption = { id: string; name: string };

type ExplorerProps = {
  variant: "explorer";
  windowDays: WindowDays;
  mode: "pivot" | "priorities";
  sort: string;
  dir: string;
  departmentId?: string;
  scopedDepartments: DepartmentOption[];
  buildUrl: (overrides: Record<string, string>) => string;
};

type InstructionProps = {
  variant: "instruction";
  windowDays: WindowDays;
  departmentId?: string;
  scopedDepartments: DepartmentOption[];
};

export type TeachersFilterToolbarProps = ExplorerProps | InstructionProps;

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
      <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16l4-4 4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="teachers-filter-toolbar__head">
      <span className="teachers-filter-toolbar__icon" aria-hidden>
        {icon}
      </span>
      <span className="teachers-filter-toolbar__label">{label}</span>
    </div>
  );
}

function instructionTeachersHref(args: { windowDays: number; departmentId?: string }): string {
  const qs = new URLSearchParams();
  qs.set("windowDays", String(args.windowDays));
  if (args.departmentId) qs.set("departmentId", args.departmentId);
  return `/instruction/teachers?${qs.toString()}`;
}

export function TeachersFilterToolbar(props: TeachersFilterToolbarProps) {
  if (props.variant === "explorer") {
    const { windowDays, mode, sort, dir, departmentId, scopedDepartments, buildUrl } = props;
    return (
      <div className="teachers-filter-toolbar">
        <div className="teachers-filter-toolbar__section">
          <SectionHeader icon={<CalendarIcon />} label="Time window" />
          <div className="filter-period-toggle w-fit max-w-full">
            {VALID_WINDOWS.map((w) => (
              <Link
                key={w}
                href={buildUrl({ windowDays: String(w), page: "1" })}
                className={`filter-period-btn ${w === windowDays ? "filter-period-btn-active" : ""}`}
              >
                {w}D
              </Link>
            ))}
          </div>
        </div>
        <div className="teachers-filter-toolbar__divider" aria-hidden />
        <div className="teachers-filter-toolbar__section">
          <SectionHeader icon={<ChartIcon />} label="View" />
          <div className="filter-period-toggle w-fit max-w-full">
            <Link
              href={buildUrl({ mode: "pivot", page: "1" })}
              className={`filter-period-btn ${mode === "pivot" ? "filter-period-btn-active" : ""}`}
            >
              Performance view
            </Link>
            <Link
              href={buildUrl({ mode: "priorities", page: "1" })}
              className={`filter-period-btn ${mode === "priorities" ? "filter-period-btn-active" : ""}`}
            >
              Priority view
            </Link>
          </div>
        </div>
        <div className="teachers-filter-toolbar__divider" aria-hidden />
        <div className="teachers-filter-toolbar__section sm:flex-[1.15]">
          <SectionHeader icon={<UserIcon />} label="Department" />
          <form className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center" method="GET" action="/explorer/teachers">
            <input type="hidden" name="windowDays" value={String(windowDays)} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input type="hidden" name="page" value="1" />
            <div className="min-w-0 flex-1">
              <select
                name="departmentId"
                defaultValue={departmentId ?? ""}
                className="field field-filter-trigger w-full min-w-0 !rounded-[10px] !py-2.5 !pl-3 !pr-9 !text-[0.8125rem] font-medium"
                aria-label="Department"
              >
                <option value="">All Departments</option>
                {scopedDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-teachers-toolbar-apply shrink-0">
              <FunnelIcon />
              Apply
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { windowDays, scopedDepartments, departmentId } = props;

  const preservedDeptId =
    departmentId && scopedDepartments.some((d) => d.id === departmentId) ? departmentId : undefined;

  return (
    <div className="teachers-filter-toolbar">
      <div className="teachers-filter-toolbar__section">
        <SectionHeader icon={<CalendarIcon />} label="Time window" />
        <div className="filter-period-toggle w-fit max-w-full">
          {VALID_WINDOWS.map((w) => (
            <Link
              key={w}
              href={instructionTeachersHref({ windowDays: w, departmentId: preservedDeptId })}
              className={`filter-period-btn ${w === windowDays ? "filter-period-btn-active" : ""}`}
            >
              {w}D
            </Link>
          ))}
        </div>
      </div>
      <div className="teachers-filter-toolbar__divider" aria-hidden />
      <div className="teachers-filter-toolbar__section sm:flex-[1.15]">
        <SectionHeader icon={<UserIcon />} label="Department" />
        <form className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center" method="GET" action="/instruction/teachers">
          <input type="hidden" name="windowDays" value={String(windowDays)} />
          <div className="min-w-0 flex-1">
            <select
              name="departmentId"
              defaultValue={departmentId ?? ""}
              className="field field-filter-trigger w-full min-w-0 !rounded-[10px] !py-2.5 !pl-3 !pr-9 !text-[0.8125rem] font-medium"
              aria-label="Department"
            >
              <option value="">All Departments</option>
              {scopedDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-teachers-toolbar-apply shrink-0">
            <FunnelIcon />
            Apply
          </button>
        </form>
      </div>
    </div>
  );
}
