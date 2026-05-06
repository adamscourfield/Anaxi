const props = [
  {
    title: "Academic Ledger",
    description:
      "Immutable records that provide a single point of truth for every student and staff interaction within your trust.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M7 7h6M7 10h6M7 13h4"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M13 3v3"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    iconBg: "rgba(99,102,241,0.08)",
    accent: "#6366f1",
  },
  {
    title: "Clinical Precision",
    description:
      "No fluff. Every interface is optimized for high-speed professional usage, reducing cognitive load on busy educators.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="#131b2e" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="3" stroke="#131b2e" strokeWidth="1.5" />
        <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="#131b2e" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    iconBg: "rgba(19,27,46,0.07)",
    accent: "#131b2e",
  },
  {
    title: "Secure Foundation",
    description:
      "Enterprise-grade security and compliance built into the architecture, not as an afterthought.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2.5L3.5 5.5v5c0 3.6 2.8 6.9 6.5 7.5 3.7-.6 6.5-3.9 6.5-7.5v-5L10 2.5z"
          stroke="#059669"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M7 10l2 2 4-4"
          stroke="#059669"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    iconBg: "rgba(5,150,105,0.08)",
    accent: "#059669",
  },
];

export default function ValuePropsSection() {
  return (
    <section className="bg-white py-24 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span
            className="inline-block text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Built Different
          </span>
          <h2
            className="text-3xl lg:text-4xl font-semibold tracking-tight"
            style={{ color: "var(--on-surface)" }}
          >
            Crafted for the most ambitious{" "}
            <em className="italic font-semibold">educational institutions.</em>
          </h2>
        </div>

        {/* Three-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {props.map((prop) => (
            <div
              key={prop.title}
              className="flex flex-col gap-4 p-7 rounded-2xl transition-shadow duration-200 hover:shadow-md"
              style={{
                border: "1px solid var(--outline-variant)",
                background: "var(--surface-container-lowest)",
              }}
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: prop.iconBg }}
              >
                {prop.icon}
              </div>

              {/* Text */}
              <div className="flex flex-col gap-2">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--on-surface)" }}
                >
                  {prop.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--on-surface-variant)" }}
                >
                  {prop.description}
                </p>
              </div>

              {/* Accent underline */}
              <div
                className="mt-auto h-0.5 w-8 rounded-md"
                style={{ background: prop.accent, opacity: 0.4 }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
