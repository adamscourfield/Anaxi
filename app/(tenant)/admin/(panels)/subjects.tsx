import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { SubjectsAdminView } from "@/components/admin/subjects-admin-view";
import {
  addSubject,
  updateSubject,
  toggleSubjectActive,
  deleteSubject,
  reorderSubjects,
} from "@/app/(tenant)/admin/subjects/actions";

export async function SubjectsAdminPanel() {
  const user = await requireAdminUser();

  const subjects = await prisma.subject.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const rows = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    stages: s.stages,
    active: s.active,
  }));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        variant="ledger"
        title="Subjects"
        titleClassName="!text-[var(--on-surface)]"
        subtitleClassName="anx-page-subtitle !text-[var(--on-surface-variant)]"
        subtitle="The canonical subject list used by attainment uploads and grade entry, tagged by key stage."
      />

      <SubjectsAdminView
        rows={rows}
        addSubject={addSubject}
        updateSubject={updateSubject}
        toggleSubjectActive={toggleSubjectActive}
        deleteSubject={deleteSubject}
        reorderSubjects={reorderSubjects}
      />
    </div>
  );
}
