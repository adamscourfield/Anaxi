"use client";

import Link from "next/link";
import { buildPageNumbers } from "@/lib/pagination";

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text disabled:pointer-events-none disabled:opacity-40";

const pageBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] calm-transition";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  /** e.g. "staff", "results", "teachers" */
  itemLabel?: string;
  className?: string;
  onPageChange?: (page: number) => void;
  pageHref?: (page: number) => string;
};

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = "items",
  className = "",
  onPageChange,
  pageHref,
}: TablePaginationProps) {
  if (totalItems === 0 || totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);
  const pages = buildPageNumbers(safePage, totalPages);

  const PrevControl =
    safePage > 1 ? (
      pageHref ? (
        <Link href={pageHref(safePage - 1)} className={navBtn} aria-label="Previous page">
          <ChevronLeftIcon />
        </Link>
      ) : (
        <button type="button" onClick={() => onPageChange?.(safePage - 1)} className={navBtn} aria-label="Previous page">
          <ChevronLeftIcon />
        </button>
      )
    ) : (
      <span className={`${navBtn} opacity-40`} aria-hidden>
        <ChevronLeftIcon />
      </span>
    );

  const NextControl =
    safePage < totalPages ? (
      pageHref ? (
        <Link href={pageHref(safePage + 1)} className={navBtn} aria-label="Next page">
          <ChevronRightIcon />
        </Link>
      ) : (
        <button type="button" onClick={() => onPageChange?.(safePage + 1)} className={navBtn} aria-label="Next page">
          <ChevronRightIcon />
        </button>
      )
    ) : (
      <span className={`${navBtn} opacity-40`} aria-hidden>
        <ChevronRightIcon />
      </span>
    );

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5 ${className}`.trim()}
    >
      <p className="text-[0.8125rem] text-muted">
        Showing{" "}
        <span className="font-semibold text-text">
          {rangeStart}-{rangeEnd}
        </span>{" "}
        of <span className="font-semibold text-text">{totalItems.toLocaleString()}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        {PrevControl}
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex h-8 w-8 items-center justify-center text-[0.8125rem] text-muted"
            >
              …
            </span>
          ) : p === safePage ? (
            <span
              key={p}
              className={`${pageBtn} bg-accent font-semibold text-on-primary`}
              aria-current="page"
            >
              {p}
            </span>
          ) : pageHref ? (
            <Link key={p} href={pageHref(p)} className={`${pageBtn} text-muted hover:bg-surface-container-low hover:text-text`}>
              {p}
            </Link>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange?.(p)}
              className={`${pageBtn} text-muted hover:bg-surface-container-low hover:text-text`}
            >
              {p}
            </button>
          ),
        )}
        {NextControl}
      </div>
    </div>
  );
}
