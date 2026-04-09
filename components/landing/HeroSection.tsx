import Image from "next/image";
import Link from "next/link";
import DashboardMockup from "./DashboardMockup";

export default function HeroSection() {
  return (
    <section className="bg-white pt-16 pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="flex flex-col gap-8">
            <div>
              <span className="inline-block text-2xs font-semibold uppercase tracking-[0.15em] text-[var(--on-surface-variant)] mb-5">
                Institutional Intelligence
              </span>
              <h1 className="text-5xl lg:text-6xl font-semibold text-[var(--on-surface)] leading-[1.05] tracking-tight mb-5">
                The Future of Education
              </h1>
              <p className="text-base text-[var(--on-surface-variant)] leading-relaxed max-w-md">
                School intelligence — operations + learning in one place. Engineered for institutional confidence.
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <Link
                href="/login"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[var(--primary-container)] text-white text-sm font-medium hover:opacity-90 transition-opacity duration-150"
              >
                Request Demo
              </Link>
              <Link
                href="#dual-engine"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--on-surface)] hover:text-[var(--on-surface-variant)] transition-colors duration-150"
              >
                Explore the Platform
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right: image + dashboard mockup */}
          <div className="relative flex items-center justify-center lg:justify-end">
            {/* Arch photo container */}
            <div className="relative w-full max-w-[480px] h-[400px] lg:h-[480px] rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="/hero-image.png"
                alt="Architectural arches representing institutional structure"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 480px"
              />
              {/* Subtle dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e]/40 via-transparent to-transparent" />
            </div>

            {/* Dashboard mockup — floating card */}
            <div className="absolute -bottom-6 -left-4 lg:-left-12 z-10 w-[260px] lg:w-[280px]">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
