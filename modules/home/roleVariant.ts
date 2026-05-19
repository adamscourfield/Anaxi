import { UserRole } from "@/lib/types";

export type HomeVariant = "leadership" | "hod" | "coach" | "teacher";

export function resolveHomeVariant(role: UserRole, coacheeCount: number): HomeVariant {
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SLT") return "leadership";
  if (role === "HOD") return "hod";
  if (role === "LEADER" && coacheeCount > 0) return "coach";
  return "teacher";
}

export function showsInsightWindow(variant: HomeVariant): boolean {
  return variant === "leadership" || variant === "hod" || variant === "coach";
}
