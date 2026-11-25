import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { ClassesDirectory } from "@/components/classes/directory";
import { classSettings } from "@/modules/classes/settings";
import { loadClasses } from "@/modules/classes/data";
import { requireClassesAccess } from "@/modules/classes/access";

import "./classes.css";

export const metadata = { title: "Classes | Anaxi" };
export const dynamic = "force-dynamic";

export default async function ClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getSessionUserOrThrow();
  await requireClassesAccess(user);
  const params = await searchParams;
  // Old links opened a class with ?class=<id>; classes now have their own page.
  if (typeof params.class === "string" && params.class) redirect(`/classes/${params.class}`);

  const settings = await classSettings(user.tenantId);
  const { classes } = await loadClasses(user.tenantId, 21, settings.behaviourThrough, { outcomes: false });
  const myClassIds = classes.filter((c) => c.teachers.some((t) => t.id === user.id)).map((c) => c.id);

  return (
    <div className="class-page space-y-8">
      <PageHeader
        variant="ledger"
        title="Classes"
        subtitle="Every teaching group with its teachers and pupils. Open a class to see attendance, behaviour and attainment."
      />
      <ClassesDirectory
        classes={classes.map(({ id, name, subject, yearGroup, teachers, count, attendance }) => ({ id, name, subject, yearGroup, teachers, count, attendance }))}
        myClassIds={myClassIds}
      />
    </div>
  );
}
