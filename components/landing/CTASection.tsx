import Link from "next/link";

export default function CTASection() {
  return (
    <section className="bg-[var(--surface-container-low)] py-24">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl lg:text-5xl font-semibold text-[var(--on-surface)] tracking-tight mb-5">
          Ready to evolve your institutional intelligence?
        </h2>
        <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed mb-10 max-w-xl mx-auto">
          Join the next generation of schools moving beyond legacy management systems into the era of data-driven pedagogy.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-[var(--primary-container)] text-white text-sm font-medium hover:opacity-90 transition-opacity duration-150"
          >
            Start Your Demo
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 rounded-lg border border-[var(--outline-variant)] text-[var(--on-surface)] text-sm font-medium hover:bg-[var(--surface-container)] transition-colors duration-150"
          >
            Talk to an Advisor
          </Link>
        </div>
      </div>
    </section>
  );
}
