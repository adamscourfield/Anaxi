import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import ValuePropsSection from "@/components/landing/ValuePropsSection";
import DualEngineSection from "@/components/landing/DualEngineSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center font-sans px-6"
      style={{ background: "var(--surface-container-lowest)" }}
    >
      {/* Logo */}
      <Image
        src="/anaxi-logo.png"
        alt="Anaxi"
        width={56}
        height={56}
        priority
        className="h-14 w-14 object-contain"
      />

      {/* Wordmark */}
      <p
        className="mt-5 text-xs font-semibold uppercase tracking-[0.22em]"
        style={{ color: "var(--on-surface-variant)" }}
      >
        Anaxi
      </p>

      {/* Tagline */}
      <p
        className="mt-3 text-sm"
        style={{ color: "var(--on-surface-variant)", opacity: 0.6 }}
      >
        Institutional intelligence for schools.
      </p>

      {/* Sign in */}
      <Link
        href="/login"
        className="mt-10 inline-flex items-center justify-center px-8 py-2.5 rounded-lg text-sm font-medium text-white calm-transition hover:opacity-90 active:scale-[0.98]"
        style={{ background: "var(--primary-container)" }}
      >
        Sign in
      </Link>
    </div>
  );
}
