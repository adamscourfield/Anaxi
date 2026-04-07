import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      className="h-dvh min-h-0 flex flex-col items-center justify-center gap-8 px-6 py-8 overflow-hidden"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      <div className="flex flex-col items-center gap-5 text-center max-w-lg">
        <Image
          src="/anaxi-logo.png"
          alt="Anaxi"
          width={64}
          height={64}
          priority
          className="h-16 w-16 object-contain"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
          Institutional intelligence
        </p>
        <div className="space-y-3">
          <h1 className="font-newsreader text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--on-surface)] leading-tight">
            Anaxi
          </h1>
          <p className="text-base text-[var(--on-surface-variant)] leading-relaxed">
            Bring school operations and learning insight together in one secure workspace—built for trusts and schools that need clarity at speed.
          </p>
          <p className="text-sm text-[var(--on-surface-variant)] leading-snug">
            <span className="text-[var(--on-surface)] font-medium">One ledger</span> for student and staff activity ·{" "}
            <span className="text-[var(--on-surface)] font-medium">Fast, focused</span> tools for daily work ·{" "}
            <span className="text-[var(--on-surface)] font-medium">Security</span> in the architecture
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full min-h-12 px-8 rounded-xl bg-[var(--primary-container)] text-white text-base font-semibold hover:opacity-90 transition-opacity"
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
