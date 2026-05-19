import { prisma } from "@/lib/prisma";
import { sendOnboardingEmail } from "@/lib/email";
import { StaffCsvRecord, StaffCsvError } from "./csv";

export interface StaffImportResult {
  jobId: string;
  rowsProcessed: number;
  rowsFailed: number;
  errors: StaffImportRowError[];
}

export interface StaffImportRowError {
  rowNumber: number;
  email: string;
  fullName: string;
  errorCode: string;
  message: string;
}

export async function runStaffImport(
  tenantId: string,
  uploadedBy: string,
  fileName: string,
  rows: StaffCsvRecord[],
  parseErrors: StaffCsvError[]
): Promise<StaffImportResult> {
  // Create import job
  const job = await (prisma as any).importJob.create({
    data: {
      tenantId,
      type: "STAFF_IMPORT",
      status: "RUNNING",
      uploadedBy,
      fileName,
      rowCount: rows.length,
      rowsProcessed: 0,
      rowsFailed: 0,
      startedAt: new Date(),
    },
  });

  const rowErrors: StaffImportRowError[] = [];

  // Convert parse errors to row errors for tracking
  for (const pe of parseErrors) {
    rowErrors.push({
      rowNumber: pe.rowNumber,
      email: "",
      fullName: "",
      errorCode: pe.errorCode,
      message: pe.message,
    });
  }

  let rowsProcessed = 0;
  let rowsFailed = parseErrors.length;

  // Batch-fetch existing user emails to detect new vs. updated users without N+1 queries
  const existingUsers = await (prisma as any).user.findMany({
    where: { tenantId, email: { in: rows.map((r) => r.email) } },
    select: { email: true },
  });
  const existingEmails = new Set<string>(existingUsers.map((u: { email: string }) => u.email));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    try {
      const isNewUser = !existingEmails.has(row.email);

      // 1) Upsert User by (tenantId, email)
      const user = await (prisma as any).user.upsert({
        where: { tenantId_email: { tenantId, email: row.email } },
        update: { fullName: row.fullName, role: row.role, isActive: row.membershipStatus !== "ARCHIVED" },
        create: {
          tenantId,
          email: row.email,
          fullName: row.fullName,
          role: row.role,
          isActive: row.membershipStatus !== "ARCHIVED",
          canApproveAllLoa: false,
          receivesOnCallEmails: false,
        },
      });

      // 2) Departments + DepartmentMembership
      const deptIds: Record<string, string> = {};
      for (const deptName of row.departments) {
        const dept = await (prisma as any).department.upsert({
          where: { tenantId_name: { tenantId, name: deptName } },
          update: {},
          create: { tenantId, name: deptName },
        });
        deptIds[deptName] = dept.id;

        await (prisma as any).departmentMembership.upsert({
          where: { departmentId_userId: { departmentId: dept.id, userId: user.id } },
          update: {},
          create: { tenantId, departmentId: dept.id, userId: user.id, isHeadOfDepartment: false },
        });
      }

      // 3) HOD flags
      // Determine HOD target departments
      let hodTargetNames: string[] = [];
      if (row.hodDepartments.length > 0) {
        hodTargetNames = row.hodDepartments;
      } else if (row.isHOD) {
        hodTargetNames = row.departments;
      }

      // Set isHeadOfDepartment = false for all existing dept memberships (row is source of truth)
      await (prisma as any).departmentMembership.updateMany({
        where: { userId: user.id, tenantId },
        data: { isHeadOfDepartment: false },
      });

      // Set isHeadOfDepartment = true for HOD target depts
      for (const hodDeptName of hodTargetNames) {
        // Ensure department exists (may not be in departments list)
        const hodDept = await (prisma as any).department.upsert({
          where: { tenantId_name: { tenantId, name: hodDeptName } },
          update: {},
          create: { tenantId, name: hodDeptName },
        });

        await (prisma as any).departmentMembership.upsert({
          where: { departmentId_userId: { departmentId: hodDept.id, userId: user.id } },
          update: { isHeadOfDepartment: true },
          create: { tenantId, departmentId: hodDept.id, userId: user.id, isHeadOfDepartment: true },
        });
      }

      // 4) Coach assignment
      if (row.coachEmail) {
        const coachUser = await (prisma as any).user.findFirst({
          where: { tenantId, email: row.coachEmail },
        });

        if (coachUser) {
          await (prisma as any).coachAssignment.upsert({
            where: {
              tenantId_coachUserId_coacheeUserId: {
                tenantId,
                coachUserId: coachUser.id,
                coacheeUserId: user.id,
              },
            },
            update: {},
            create: {
              tenantId,
              coachUserId: coachUser.id,
              coacheeUserId: user.id,
            },
          });
        } else {
          rowErrors.push({
            rowNumber,
            email: row.email,
            fullName: row.fullName,
            errorCode: "COACH_NOT_FOUND",
            message: `Coach with email "${row.coachEmail}" not found in tenant`,
          });
        }
      }

      // 5) Send onboarding email for newly created active users
      if (isNewUser && row.membershipStatus !== "ARCHIVED") {
        // Fire-and-forget — email failures should not block the import
        sendOnboardingEmail({
          to: row.email,
          fullName: row.fullName,
          tenantId,
          userId: user.id,
        }).catch((err) => {
          console.error("[staff-import] onboarding email failed", row.email, err);
        });
      }

      rowsProcessed++;
    } catch (err: any) {
      rowsFailed++;
      rowErrors.push({
        rowNumber,
        email: row.email,
        fullName: row.fullName,
        errorCode: "IMPORT_ERROR",
        message: err?.message ?? "Unknown error",
      });
    }
  }

  // Update import job
  await (prisma as any).importJob.update({
    where: { id: job.id },
    data: {
      status: rowsFailed > 0 ? "FAILED" : "SUCCESS",
      rowsProcessed,
      rowsFailed,
      errorReportJson: rowErrors.length > 0 ? rowErrors : null,
      finishedAt: new Date(),
    },
  });

  return { jobId: job.id, rowsProcessed, rowsFailed, errors: rowErrors };
}
