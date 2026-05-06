export default function DashboardMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden w-full"
      style={{
        background: "white",
        border: "1px solid var(--outline-variant)",
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)",
      }}
    >
      {/* Card header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--outline-variant)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "var(--surface-container)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="1" fill="var(--on-surface-variant)" />
              <rect x="7" y="1" width="4" height="4" rx="1" fill="var(--on-surface-variant)" opacity="0.4" />
              <rect x="1" y="7" width="4" height="4" rx="1" fill="var(--on-surface-variant)" opacity="0.4" />
              <rect x="7" y="7" width="4" height="4" rx="1" fill="var(--on-surface-variant)" opacity="0.4" />
            </svg>
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--on-surface)" }}>
            Institutional Pulse
          </span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-md"
          style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)" }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          <span className="text-2xs font-medium" style={{ color: "var(--success)" }}>
            Live
          </span>
        </div>
      </div>

      {/* Efficiency index */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--outline-variant)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-2xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Efficiency Index
          </span>
          <span className="text-lg font-bold" style={{ color: "var(--on-surface)" }}>
            94.1%
          </span>
        </div>
        <div
          className="w-full h-1.5 rounded-sm overflow-hidden"
          style={{ background: "var(--surface-container)" }}
        >
          <div
            className="h-full rounded-md"
            style={{ width: "94.1%", background: "var(--primary-container)" }}
          />
        </div>
      </div>

      {/* Metric rows */}
      <div className="px-4 py-3 space-y-3">
        {[
          { label: "Staff Observations", value: "38", change: "+4", positive: true },
          { label: "On-Call Requests", value: "12", change: "-2", positive: true },
          { label: "Leave Approvals", value: "7", change: "0", positive: null },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--on-surface-variant)" }}>
              {row.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--on-surface)" }}>
                {row.value}
              </span>
              {row.change !== "0" && (
                <span
                  className="text-2xs font-medium"
                  style={{ color: row.positive ? "#059669" : "#dc2626" }}
                >
                  {row.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: "var(--surface-container-low)" }}
      >
        <span className="text-2xs" style={{ color: "var(--on-surface-variant)" }}>
          Updated just now
        </span>
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1 h-3 rounded-md"
              style={{
                background: "var(--primary-container)",
                opacity: i === 1 ? 1 : i === 2 ? 0.45 : 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
