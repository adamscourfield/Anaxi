import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ClassDetail } from "@/components/classes/detail";
import { classSettings } from "@/modules/classes/settings";
import { loadClasses } from "@/modules/classes/data";
import { requireClassesAccess } from "@/modules/classes/access";
import { formatYearGroups } from "@/modules/classes/presentation";
import "../classes.css";

export const metadata = { title: "Class | Anaxi" };
export const dynamic = "force-dynamic";

const WINDOWS = [7, 14, 21, 28];

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireClassesAccess(user);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requested = Number(query.window);
  const windowDays = WINDOWS.includes(requested) ? requested : 21;
  const settings = await classSettings(user.tenantId);
  const { classes } = await loadClasses(user.tenantId, windowDays, settings.behaviourThrough, { classId: id });
  const data = classes[0];
  if (!data) notFound();

  // The day window only applies when behaviour comes from individual events, not MIS totals.
  const usesEventWindow = !data.behaviourSnapshots.length && !data.behaviourPending;
  const teacherNames = data.teachers.map((t) => t.name);

  return (
    <div className="class-page space-y-8">
      <header className="space-y-4 border-b border-[#e5e5e6] pb-7">
        <Breadcrumb items={[{ label: "Classes", href: "/classes" }, { label: data.name }]} />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.04em]">
              {data.name}
              <span className="text-[#ff6a52]">.</span>
            </h1>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              {data.subject} · {formatYearGroups(data.yearGroup)} · {data.count} {data.count === 1 ? "pupil" : "pupils"}
            </p>
            {teacherNames.length ? (
              <details className="class-teachers mt-2">
                <summary>
                  Taught by {teacherNames.length <= 2 ? teacherNames.join(" and ") : `${teacherNames.slice(0, 2).join(", ")} and ${teacherNames.length - 2} more`}
                </summary>
                {teacherNames.length > 2 ? <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#3a3a3c]">{teacherNames.join(", ")}</p> : null}
              </details>
            ) : null}
          </div>
          {usesEventWindow ? (
            <nav className="class-segmented" aria-label="Behaviour period">
              {WINDOWS.map((days) => (
                <Link
                  key={days}
                  href={`/classes/${id}?window=${days}`}
                  replace
                  scroll={false}
                  aria-current={windowDays === days ? "page" : undefined}
                >
                  {days} days
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
      <ClassDetail key={data.id} data={data} windowDays={windowDays} labels={settings.labels} />
    </div>
  );
}
