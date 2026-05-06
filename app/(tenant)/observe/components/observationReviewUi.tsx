import type { ReactNode } from "react";
import Link from "next/link";

/** Observation review read-only / wizard styling (#F9FAFB page, #1F2937 teacher card, pill rows). */

export const OBS_REVIEW_PAGE_BG = "bg-[#F9FAFB]";
export const OBS_REVIEW_TEXT = "text-[#111827]";
export const OBS_REVIEW_MUTED = "text-[#6B7280]";
export const OBS_REVIEW_CARD_DARK = "bg-[#1F2937]";
export const OBS_REVIEW_SIDEBAR_LABEL = "text-[#93C5FD]";
export const OBS_REVIEW_STATUS_ACCENT = "text-[#EC4899]";

export function ObservationReviewBackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-medium ${OBS_REVIEW_MUTED} transition-colors hover:text-[#111827] print:hidden`}
    >
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
        <path
          d="M10 3.5 5.5 8l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </Link>
  );
}

export function ObservationReviewSectionHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 [&_svg]:h-[18px] [&_svg]:w-[18px]"
        aria-hidden
      >
        {icon}
      </span>
      <h2 className={`text-[0.9375rem] font-semibold tracking-tight ${OBS_REVIEW_TEXT}`}>{title}</h2>
    </div>
  );
}

export function ObservationReviewSignalRow({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[999px] bg-[#E5E7EB]/90 px-5 py-3.5 ${OBS_REVIEW_TEXT}`}
    >
      {icon ?? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white">
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <span className="text-[0.875rem] font-medium">{children}</span>
    </div>
  );
}

export function ObservationReviewTeacherCard({
  initials,
  name,
  roleUppercase,
  rows,
}: {
  initials: string;
  name: string;
  roleUppercase: string;
  rows: { icon: ReactNode; label: string; value: string }[];
}) {
  return (
    <div className={`overflow-hidden rounded-xl ${OBS_REVIEW_CARD_DARK} shadow-sm`}>
      <div className="px-5 pb-6 pt-7 text-center">
        <div
          className="mx-auto flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-md bg-[#374151] text-lg font-bold text-white"
          aria-hidden
        >
          {initials}
        </div>
        <h3 className="mt-4 text-[1.125rem] font-bold leading-snug text-white">{name}</h3>
        <p className={`mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${OBS_REVIEW_SIDEBAR_LABEL}`}>
          {roleUppercase}
        </p>
      </div>
      <ul className="border-t border-white/10 px-5 pb-6">
        {rows.map((row, i) => (
          <li
            key={`${row.label}-${i}`}
            className={`flex gap-3 py-3.5 ${i > 0 ? "border-t border-white/10" : ""}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-[#9CA3AF] [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {row.icon}
            </span>
            <div className="min-w-0 pt-0.5 text-left">
              <p className={`text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${OBS_REVIEW_SIDEBAR_LABEL}`}>
                {row.label}
              </p>
              <p className="mt-0.5 text-[0.8125rem] font-medium leading-snug text-white">{row.value}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ObservationReviewSessionCard({
  rows,
}: {
  rows: { icon: ReactNode; label: string; value: ReactNode; accent?: boolean }[];
}) {
  return (
    <div>
      <p className={`mb-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] ${OBS_REVIEW_MUTED}`}>Session Context</p>
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        {rows.map((row, i) => (
          <div
            key={`${row.label}-${i}`}
            className={`flex items-start gap-3 px-4 py-4 ${i < rows.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#F3F4F6] text-[#6B7280] [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {row.icon}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${OBS_REVIEW_MUTED}`}>{row.label}</p>
              <div className={`mt-1 text-[0.875rem] font-semibold ${row.accent ? OBS_REVIEW_STATUS_ACCENT : OBS_REVIEW_TEXT}`}>
                {row.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
