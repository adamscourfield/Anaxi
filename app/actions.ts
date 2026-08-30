"use server";

import { assertSafeServerAction } from "@/lib/serverActionGuard";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireRole } from "@/lib/guards";

type ImportType = "STUDENTS_SNAPSHOT" | "STUDENT_SUBJECT_TEACHERS";

export async function createImportJob(type: ImportType, fileName: string) {
  await assertSafeServerAction();
  const user = await getSessionUserOrThrow();
  requireRole(user, ["LEADER", "SLT", "ADMIN", "SUPER_ADMIN"]);

  return prisma.importJob.create({
    data: {
      tenantId: user.tenantId,
      type,
      status: "PENDING",
      uploadedBy: user.id,
      fileName,
      rowCount: 0,
    }
  });
}
