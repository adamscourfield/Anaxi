"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWatchlist } from "@/app/(tenant)/analysis/students/actions";

export function WatchlistToggle({
  studentId,
  initialOnWatchlist,
}: {
  studentId: string;
  initialOnWatchlist: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title={initialOnWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      aria-label={initialOnWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-accent disabled:opacity-50"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await toggleWatchlist(studentId);
          router.refresh();
        });
      }}
    >
      <span className={initialOnWatchlist ? "text-accent" : "opacity-40"} aria-hidden>
        {initialOnWatchlist ? "★" : "☆"}
      </span>
    </button>
  );
}
