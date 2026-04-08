import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative h-dvh min-h-0 flex flex-col items-center justify-center gap-8 px-6 py-8 overflow-hidden text-[var(--on-surface)] bg-[var(--surface-bright)]">
      <div className="landing-ambient" aria-hidden>
        <div className="landing-beam" />
        <div className="landing-orb landing-orb--1" />
        <div className="landing-orb landing-orb--2" />
        <div className="landing-orb landing-orb--3" />
        <div className="landing-grid" />
        <div className="landing-ring" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-lg">
        <Image
          src="/anaxi-logo.png"
          alt="Anaxi"
          width={64}
          height={64}
          priority
          className="h-16 w-16 object-contain drop-shadow-sm"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
          Institutional intelligence
        </p>
        <div className="space-y-0">
          <h1 className="font-newsreader text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--on-surface)] leading-tight">
            Anaxi
          </h1>
          <div className="landing-motif" aria-hidden>
            <span className="landing-motif-bar landing-motif-bar--wide" />
            <span className="landing-motif-bar landing-motif-bar--narrow" />
            <span className="landing-motif-node" />
            <span className="landing-motif-bar landing-motif-bar--narrow" />
          </div>
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-xs">
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full min-h-12 px-8 rounded-xl bg-[var(--primary-container)] text-white text-base font-semibold shadow-md hover:opacity-90 transition-opacity"
        >
          Sign in
        </Link>
        <Link
          href="/login/forgot-password"
          className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}
