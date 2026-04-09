export default function DashboardMockup() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-[var(--outline-variant)] overflow-hidden w-full max-w-sm">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-[var(--outline-variant)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[var(--surface-container)] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="1" fill="var(--on-surface-variant)" />
              <rect x="7" y="1" width="4" height="4" rx="1" fill="var(--on-surface-variant)" opacity="0.4" />
              <rect x="1" y="7" width="4" height="4" rx="1" fill="var(--on-surface-variant)" opacity="0.4" />
              <rect x="7" y="7" width="4" height="4" rx="1" fill="var(--on-surface-variant)" opacity="0.4" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--on-surface)]">Institutional Pulse</span>
        </div>
        <div className="w-5 h-5 rounded-md bg-[var(--surface-container)] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="var(--on-surface-variant)" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Efficiency index */}
      <div className="px-5 py-4 border-b border-[var(--outline-variant)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold uppercase tracking-widest text-[var(--on-surface-variant)]">
            Efficiency Index
          </span>
          <span className="text-xl font-bold text-[var(--on-surface)]">94.1%</span>
        </div>
        <div className="w-full h-1.5 bg-[var(--surface-container)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary-container)] rounded-full"
            style={{ width: "94.1%" }}
          />
        </div>
      </div>

      {/* Metric rows */}
      <div className="px-5 py-3 space-y-3">
        {[
          { label: "Staff Observations", value: "38", change: "+4", positive: true },
          { label: "On-Call Requests", value: "12", change: "-2", positive: true },
          { label: "Leave Approvals", value: "7", change: "0", positive: null },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-xs text-[var(--on-surface-variant)]">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--on-surface)]">{row.value}</span>
              {row.change !== "0" && (
                <span
                  className={`text-2xs font-medium ${
                    row.positive ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {row.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div className="px-5 py-3 bg-[var(--surface-container-low)] flex items-center justify-between">
        <span className="text-2xs text-[var(--on-surface-variant)]">Updated just now</span>
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 h-3 rounded-full bg-[var(--primary-container)]"
              style={{ opacity: i === 1 ? 1 : i === 2 ? 0.5 : 0.25 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
