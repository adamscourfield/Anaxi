import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { ObservationContextForm } from "../components/ObservationContextForm";

export default async function NewObservationPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  requireRole(user, ["LEADER", "SLT", "ADMIN"]);

  const teachers = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId, isActive: true, role: "TEACHER" },
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
    <ObservationContextForm
      teachers={teachers as any[]}
      departments={departments as any[]}
      draftKey={draftKey}
      signalKeys={signalDefs.map((s) => s.key)}
      schoolType={schoolType}
    />
  );
}
