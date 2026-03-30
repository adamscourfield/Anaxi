"use client";

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface SegmentedTabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function SegmentedTabs({ tabs, activeKey, onChange }: SegmentedTabsProps) {
  return (
    <div className="segmented-toggle">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.key)}
            className={`segmented-toggle-btn ${active ? "segmented-toggle-btn-active" : ""}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-[18px] ${
                  active
                    ? "bg-on-surface/8 text-text"
                    : "bg-on-surface/5 text-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
