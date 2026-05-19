import type { HomeVariant } from "@/modules/home/roleVariant";

export type HomeHeaderCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export function homeHeaderCopy(variant: HomeVariant): HomeHeaderCopy {
  switch (variant) {
    case "leadership":
      return {
        eyebrow: "Today",
        title: "School pulse",
        subtitle:
          "Coverage, signals, and operational status for your school — tuned to the selected analysis window.",
      };
    case "hod":
      return {
        eyebrow: "Today",
        title: "Department pulse",
        subtitle: "Staff signals and your observation profile for the departments you lead.",
      };
    case "coach":
      return {
        eyebrow: "Today",
        title: "Coaching pulse",
        subtitle: "Coachees who need attention, your observations, and quick paths to priorities.",
      };
    case "teacher":
      return {
        eyebrow: "Today",
        title: "Your week",
        subtitle: "Your observations, actions, and operational updates in one place.",
      };
  }
}
