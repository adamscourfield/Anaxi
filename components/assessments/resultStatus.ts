import type { ResultStatus } from "@prisma/client";
import w from "./workspace.module.css";

export const STATUS_LABEL: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

/** What each status does today. (Validated and Published are treated the same by the analysis.) */
export const STATUS_MEANING: Record<ResultStatus, string> = {
  DRAFT: "Being entered. Left out of attainment insights.",
  VALIDATED: "Checked. Used in attainment insights.",
  PUBLISHED: "Signed off. Used in attainment insights.",
  LOCKED: "Final. Used in insights; grades can't be changed.",
};

export const STATUS_CLASS: Record<ResultStatus, string> = {
  DRAFT: w.draft,
  VALIDATED: w.validated,
  PUBLISHED: w.published,
  LOCKED: w.locked,
};
