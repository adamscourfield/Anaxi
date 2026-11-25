import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { ObservationContextForm } from "../components/ObservationContextForm";
import { ObservationStageLayout } from "../components/ObservationStageLayout";

export default async function NewObservationPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  if (!hasPermission(user.role, "observe:create")) redirect("/observe/history");

  // Any active member of staff can be observed -- including SLT and other
  // leaders -- so this is intentionally not filtered to role: "TEACHER".
  const teachers = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId, isActive: true, id: { not: user.id } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, email: true }
  });

  const departments = await (prisma as any).department.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  const draftKey = `observation-draft:${user.tenantId}:${user.id}`;
  const schoolType = await getTenantSchoolType(user.tenantId);
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);

  return (
    <ObservationStageLayout currentStep={1} subtitle="Who, where and which part of the lesson.">
      <ObservationContextForm
        teachers={teachers as any[]}
        departments={departments as any[]}
        draftKey={draftKey}
        signalKeys={signalDefs.map((s) => s.key)}
        schoolType={schoolType}
      />
    </ObservationStageLayout>
  );
}
