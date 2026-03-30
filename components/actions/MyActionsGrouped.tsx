"use client";

import { useState, useCallback } from "react";
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

export function MyActionsGrouped({ grouped: initial, currentUserId }: MyActionsGroupedProps) {
  const [grouped, setGrouped] = useState(initial);
  const [activeTab, setActiveTab] = useState<Tab>("All");

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
              onClick={() => setActiveTab(tab)}
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">
            {activeTab === "All" ? "No actions assigned to you" : `No ${activeTab.toLowerCase()} actions`}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">Actions created in meetings will appear here.</p>
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
