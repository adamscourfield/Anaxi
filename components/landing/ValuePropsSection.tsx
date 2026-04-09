const props = [
  {
    title: "Academic Ledger",
    description:
      "Immutable records that provide a single point of truth for every student and staff interaction within your trust.",
  },
  {
    title: "Clinical Precision",
    description:
      "No fluff. Every interface is optimized for high-speed professional usage, reducing cognitive load on busy educators.",
  },
  {
    title: "Secure Foundation",
    description:
      "Enterprise-grade security and compliance built into the architecture, not as an afterthought.",
  },
];

export default function ValuePropsSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-6">
        {/* Centered headline */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-4xl font-semibold text-[var(--on-surface)] tracking-tight">
            Crafted for the most ambitious{" "}
            <em className="italic font-semibold">educational institutions.</em>
          </h2>
        </div>

        {/* Three-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {props.map((prop) => (
            <div key={prop.title} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[var(--on-surface)]">{prop.title}</h3>
              <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">{prop.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
