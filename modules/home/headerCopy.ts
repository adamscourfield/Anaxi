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
        title: "School briefing",
        subtitle:
          "What needs attention, what’s happening today and where to look next.",
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
