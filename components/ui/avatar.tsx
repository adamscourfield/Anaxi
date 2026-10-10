"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "bg-[var(--cat-indigo-bg)] text-[var(--cat-indigo-text)]",
  "bg-[var(--scale-strong-light)] text-[var(--scale-strong-text)]",
  "bg-[var(--scale-some-light)] text-[var(--scale-some-text)]",
  "bg-[var(--scale-limited-light)] text-[var(--scale-limited-text)]",
  "bg-[var(--cat-blue-bg)] text-[var(--cat-blue-text)]",
  "bg-[var(--cat-violet-bg)] text-[var(--cat-violet-text)]",
  "bg-[var(--status-approved-light)] text-[var(--status-approved-text)]",
  "bg-[var(--scale-some-border)] text-[var(--scale-some-text)]",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  size = "sm",
  tone = "default",
  avatarUrl,
  userId,
  studentId,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Neutral grey circle (dashboard lists) vs hashed accent colors */
  tone?: "default" | "muted";
  /** When set, renders this image instead of initials. */
  avatarUrl?: string | null;
  /** Uses the authenticated staff-photo route when a precomputed URL is unavailable. */
  userId?: string | null;
  /** Uses the authenticated student-photo route when a precomputed URL is unavailable. */
  studentId?: string | null;
}) {
  const resolvedAvatarUrl = avatarUrl ?? (studentId ? `/api/students/${studentId}/avatar` : userId ? `/api/users/${userId}/avatar` : null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedAvatarUrl(null);
  }, [resolvedAvatarUrl]);

  const sizeClass =
    size === "xs"
      ? "h-6 w-6 text-[8px]"
      : size === "sm"
        ? "h-8 w-8 text-[10px]"
        : size === "md"
          ? "h-10 w-10 text-[12px]"
          : size === "lg"
            ? "h-[4.5rem] w-[4.5rem] text-xl"
            : "h-[60px] w-[60px] text-lg";

  if (resolvedAvatarUrl && failedAvatarUrl !== resolvedAvatarUrl) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={name}
        title={name}
        className={`inline-block shrink-0 rounded-[10px] object-cover ${sizeClass}`}
        onError={() => setFailedAvatarUrl(resolvedAvatarUrl)}
      />
    );
  }

  const initials = getInitials(name);
  const colorClass =
    tone === "muted"
      ? "bg-[var(--surface-container)] text-text"
      : COLORS[hashName(name) % COLORS.length];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] font-semibold ${colorClass} ${sizeClass}`}
      title={name}
    >
      {initials}
    </span>
  );
}
