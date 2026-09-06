import { parse } from "csv-parse/sync";

export const STAFF_TEMPLATE_COLUMNS = [
  "Email",
  "FullName",
  "Role",
  "Departments",
  "IsHOD",
  "HODDepartments",
  "CoachEmail",
  "MembershipStatus",
] as const;

export type StaffTemplateColumn = (typeof STAFF_TEMPLATE_COLUMNS)[number];

export const VALID_ROLES = ["ADMIN", "SLT", "HOD", "TEACHER", "SUPPORT", "HR", "ON_CALL"] as const;
export type StaffRole = (typeof VALID_ROLES)[number];

export const VALID_MEMBERSHIP_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type MembershipStatus = (typeof VALID_MEMBERSHIP_STATUSES)[number];

export interface StaffCsvRecord {
  email: string;
  fullName: string;
  role: StaffRole;
  departments: string[];
  isHOD: boolean;
  hodDepartments: string[];
  coachEmail: string;
  membershipStatus: MembershipStatus;
}

export interface StaffCsvError {
  rowNumber: number;
  field: string;
  errorCode: string;
  message: string;
}

export function parseStaffRole(raw: string): StaffRole | null {
  const v = raw.trim().toUpperCase();
  if ((VALID_ROLES as readonly string[]).includes(v)) return v as StaffRole;
  return null;
}

export function parseIsHOD(raw: string): boolean {
  const v = String(raw || "").trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(v);
}

export function parseDepartments(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);
}

export function parseMembershipStatus(raw: string): MembershipStatus | null {
  const v = raw.trim().toUpperCase();
  if (!v) return "ACTIVE";
  if ((VALID_MEMBERSHIP_STATUSES as readonly string[]).includes(v)) return v as MembershipStatus;
  return null;
}

export function generateStaffCSVTemplate(): string {
  const header = STAFF_TEMPLATE_COLUMNS.join(",");
  const example1 =
    "alice@school.example,Alice Smith,TEACHER,Maths;Science,no,,bob@school.example,ACTIVE";
  const example2 =
    "bob@school.example,Bob Jones,HOD,English,yes,English,,ACTIVE";
  return [header, example1, example2].join("\n");
}

export function parseStaffCsv(input: string): {
  parsed: StaffCsvRecord[];
  errors: StaffCsvError[];
  preview: StaffCsvRecord[];
} {
  const rows = parse(input, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const parsed: StaffCsvRecord[] = [];
  const errors: StaffCsvError[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const email = (row["Email"] || "").trim().toLowerCase();
    const fullName = (row["FullName"] || "").trim();
    const roleRaw = (row["Role"] || "").trim();
    const departmentsRaw = row["Departments"] || "";
    const isHODRaw = row["IsHOD"] || "";
    const hodDepartmentsRaw = row["HODDepartments"] || "";
    const coachEmail = (row["CoachEmail"] || "").trim().toLowerCase();
    const membershipStatusRaw = (row["MembershipStatus"] || "").trim();

    let valid = true;

    if (!email) {
      errors.push({ rowNumber, field: "Email", errorCode: "MISSING_EMAIL", message: "Email is required" });
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ rowNumber, field: "Email", errorCode: "INVALID_EMAIL", message: `Invalid email format: ${email}` });
      valid = false;
    }

    if (!fullName) {
      errors.push({ rowNumber, field: "FullName", errorCode: "MISSING_FULL_NAME", message: "FullName is recommended" });
    }

    const role = parseStaffRole(roleRaw);
    if (!role) {
      errors.push({
        rowNumber,
        field: "Role",
        errorCode: "INVALID_ROLE",
        message: `Invalid role: "${roleRaw}". Must be one of ${VALID_ROLES.join(", ")}`,
      });
      valid = false;
    }

    const membershipStatus = parseMembershipStatus(membershipStatusRaw);
    if (membershipStatus === null) {
      errors.push({
        rowNumber,
        field: "MembershipStatus",
        errorCode: "INVALID_MEMBERSHIP_STATUS",
        message: `Invalid membership status: "${membershipStatusRaw}". Must be ACTIVE or ARCHIVED`,
      });
      valid = false;
    }

    const departments = parseDepartments(departmentsRaw);
    const isHOD = parseIsHOD(isHODRaw);
    const hodDepartmentsRaw2 = parseDepartments(hodDepartmentsRaw);

    // Union HODDepartments into Departments if not already present
    const allDepartments = Array.from(new Set([...departments, ...hodDepartmentsRaw2]));

    if (valid || (!valid && role && membershipStatus !== null)) {
      parsed.push({
        email,
        fullName,
        role: role!,
        departments: allDepartments,
        isHOD,
        hodDepartments: hodDepartmentsRaw2,
        coachEmail,
        membershipStatus: membershipStatus!,
      });
    }
  });

  return { parsed, errors, preview: parsed.slice(0, 10) };
}
