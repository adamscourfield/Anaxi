import Link from "next/link";

export default function CTASection() {
  return (
    <section
      className="relative overflow-hidden py-24"
      style={{ background: "var(--primary-container)" }}
    >
      {/* Dot-grid texture, matching hero */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Soft radial glow bottom-left */}
      <div
        className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-md pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <span
          className="inline-block text-xs font-semibold uppercase tracking-[0.2em] mb-5"
          style={{ color: "rgba(255,255,255,0.38)" }}
        >
          Get Started
        </span>
        <h2 className="text-3xl lg:text-5xl font-semibold text-white tracking-tight mb-5">
          Ready to evolve your institutional intelligence?
        </h2>
        <p
          className="text-base leading-relaxed mb-10 max-w-xl mx-auto"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Join the next generation of schools moving beyond legacy management systems
          into the era of data-driven pedagogy.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center px-7 py-3 rounded-xl bg-white text-sm font-semibold transition-opacity duration-150 hover:opacity-90"
            style={{ color: "var(--primary-container)" }}
          >
            Start Your Demo
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-7 py-3 rounded-xl text-white text-sm font-medium transition-colors duration-150 hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.18)" }}
          >
            Talk to an Advisor
          </Link>
        </div>
      </div>
    </section>
  );
}
