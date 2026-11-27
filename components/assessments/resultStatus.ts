import type { ResultStatus } from "@prisma/client";
import w from "./workspace.module.css";

export const STATUS_LABEL: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

/** What each status does. (Validated was merged into Published on 27 Nov 2026: they behaved the same.) */
export const STATUS_MEANING: Record<ResultStatus, string> = {
  DRAFT: "Being entered. Left out of attainment insights.",
  PUBLISHED: "Checked. Used in attainment insights.",
  LOCKED: "Final. Used in insights; grades can't be changed.",
};

export const STATUS_CLASS: Record<ResultStatus, string> = {
  DRAFT: w.draft,
  PUBLISHED: w.published,
  LOCKED: w.locked,
};
