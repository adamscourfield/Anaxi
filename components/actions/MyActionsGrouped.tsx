"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActionCard } from "./ActionCard";

type Status = "OPEN" | "BLOCKED" | "DONE";

interface Action {
  id: string;
  description: string;
  ownerUserId: string;
  owner: { id: string; fullName: string };
  dueDate?: Date | string | null;
  status: Status;
  meeting?: { id: string; title: string } | null;
  isOverdue?: boolean;
  daysUntilDue?: number | null;
}

interface Grouped {
  OPEN: Action[];
  BLOCKED: Action[];
  DONE: Action[];
}

interface MyActionsGroupedProps {
  grouped: Grouped;
  currentUserId: string;
}

const TABS = ["All", "Open", "Blocked", "Done"] as const;
type Tab = (typeof TABS)[number];

const TAB_DOT: Record<Tab, string> = {
  All: "",
  Open: "bg-accent",
  Blocked: "bg-scale-some-bar",
  Done: "bg-scale-strong-bar",
};

const HASH_TO_TAB: Record<string, Tab> = {
  "": "All",
  all: "All",
  open: "Open",
  blocked: "Blocked",
  done: "Done",
};

function tabToHash(tab: Tab): string {
  if (tab === "All") return "";
  return tab.toLowerCase();
}

export function MyActionsGrouped({ grouped: initial, currentUserId }: MyActionsGroupedProps) {
  const router = useRouter();
  const [grouped, setGrouped] = useState(initial);
  const [activeTab, setActiveTab] = useState<Tab>("All");

  useEffect(() => {
    const syncFromHash = () => {
      const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "").toLowerCase() : "";
      const next = HASH_TO_TAB[raw] ?? "All";
      setActiveTab(next);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const setTab = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      const h = tabToHash(tab);
      if (typeof window !== "undefined") {
        const url = h ? `${window.location.pathname}${window.location.search}#${h}` : `${window.location.pathname}${window.location.search}`;
        router.replace(url, { scroll: false });
      }
    },
    [router],
  );

  const handleComplete = useCallback((actionId: string) => {
    setGrouped((prev) => {
      const action = prev.OPEN.find((a) => a.id === actionId) ?? prev.BLOCKED.find((a) => a.id === actionId);
      if (!action) return prev;
      return {
        OPEN: prev.OPEN.filter((a) => a.id !== actionId),
        BLOCKED: prev.BLOCKED.filter((a) => a.id !== actionId),
        DONE: [{ ...action, status: "DONE" as Status }, ...prev.DONE],
      };
    });
  }, []);

  const openCount = grouped.OPEN.length;
  const blockedCount = grouped.BLOCKED.length;
  const doneCount = grouped.DONE.length;
  const totalCount = openCount + blockedCount + doneCount;

  function actionsForTab(): Action[] {
    if (activeTab === "Open") return grouped.OPEN;
    if (activeTab === "Blocked") return grouped.BLOCKED;
    if (activeTab === "Done") return grouped.DONE;
    return [...grouped.OPEN, ...grouped.BLOCKED, ...grouped.DONE];
  }

  const tabActions = actionsForTab();
  const countForTab = (tab: Tab) =>
    tab === "All" ? totalCount : tab === "Open" ? openCount : tab === "Blocked" ? blockedCount : doneCount;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="segmented-toggle">
        {TABS.map((tab) => {
          const count = countForTab(tab);
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`segmented-toggle-btn flex items-center gap-1.5 ${isActive ? "segmented-toggle-btn-active" : ""}`}
            >
              {tab !== "All" && (
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? TAB_DOT[tab] : "bg-border"}`} />
              )}
              {tab}
              <span className={`text-[0.6875rem] tabular-nums ${isActive ? "text-on-surface/50" : "text-muted/70"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions list */}
      {tabActions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-lowest)_60%,transparent)] py-16">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[var(--surface-container)] text-text shadow-sm ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-text">
            {activeTab === "All" ? "No actions assigned to you" : `No ${activeTab.toLowerCase()} actions`}
          </p>
          <p className="mt-1.5 max-w-sm text-center text-[0.8125rem] leading-relaxed text-muted">
            Actions created in meetings will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tabActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              currentUserId={currentUserId}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
