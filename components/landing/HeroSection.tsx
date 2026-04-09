import Image from "next/image";
import Link from "next/link";
import DashboardMockup from "./DashboardMockup";

export default function HeroSection() {
  return (
    <section
      className="relative overflow-hidden py-20 lg:py-28"
      style={{ background: "var(--primary-container)" }}
    >
      {/* Subtle dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Soft radial glow top-right */}
      <div
        className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div className="flex flex-col gap-8">
            {/* Eyebrow */}
            <div className="flex items-center gap-3">
              <div className="h-px w-8" style={{ background: "rgba(255,255,255,0.25)" }} />
              <span
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Institutional Intelligence
              </span>
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-4xl lg:text-5xl xl:text-[3.5rem] font-semibold text-white leading-[1.05] tracking-tight">
                The Modern
                <br />
                Academic Ledger
              </h1>
              <p
                className="mt-5 text-base lg:text-lg leading-relaxed max-w-lg"
                style={{ color: "rgba(255,255,255,0.58)" }}
              >
                School intelligence — operations and learning unified in one platform.
                Engineered for institutional confidence and pedagogical precision.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/login"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-white text-sm font-semibold transition-opacity duration-150 hover:opacity-90"
                style={{ color: "var(--primary-container)" }}
              >
                Request Demo
              </Link>
              <Link
                href="#dual-engine"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-medium transition-colors duration-150 hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.18)" }}
              >
                Explore the Platform
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7h8M8 4l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex items-center gap-2 flex-wrap">
              {["Enterprise-grade security", "GDPR compliant", "Immutable audit trails"].map(
                (signal) => (
                  <div
                    key={signal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {signal}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Right: image + dashboard mockup */}
          <div className="relative flex items-center justify-center lg:justify-end mt-8 lg:mt-0">
            {/* Arch photo */}
            <div className="relative w-full max-w-[480px] h-[400px] lg:h-[460px] rounded-2xl overflow-hidden">
              <Image
                src="/hero-image.png"
                alt="Architectural arches representing institutional structure"
                fill
                className="object-cover"
                style={{ opacity: 0.65 }}
                priority
                sizes="(max-width: 1024px) 100vw, 480px"
              />
              {/* gradient fade into the section background */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, var(--primary-container) 0%, transparent 40%)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, var(--primary-container) 0%, transparent 30%)",
                }}
              />
            </div>

            {/* Dashboard mockup — floating */}
            <div className="absolute -bottom-8 -left-4 lg:-left-16 z-10 w-[260px] lg:w-[300px]">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
