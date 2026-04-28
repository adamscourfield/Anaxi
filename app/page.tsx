import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--surface-bright)] text-[var(--on-surface)]">
      {/* Ambient depth — same token language as in-app glass surfaces */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -30%, color-mix(in srgb, var(--primary-container) 14%, transparent), transparent 55%),
            radial-gradient(ellipse 70% 50% at 100% 100%, color-mix(in srgb, var(--outline-variant) 12%, transparent), transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage: `repeating-linear-gradient(
            -12deg,
            transparent,
            transparent 56px,
            color-mix(in srgb, var(--outline-variant) 8%, transparent) 56px,
            color-mix(in srgb, var(--outline-variant) 8%, transparent) 57px
          )`,
        }}
      />

      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)] bg-[var(--surface-bright)] px-4 shadow-header sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3">
          <Image
            src="/anaxi-logo.png"
            alt="Anaxi"
            width={32}
            height={32}
            priority
            className="h-8 w-8 object-contain"
          />
          <div className="mx-2 hidden h-4 w-px bg-[var(--divider-subtle)] sm:block" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Anaxi</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center px-4 py-16 sm:px-6 md:px-8 md:py-20 lg:px-10">
        <div className="mx-auto w-full max-w-[900px] text-center">
          <div className="mb-8 flex justify-center sm:mb-10">
            <Image
              src="/anaxi-logo.png"
              alt="Anaxi"
              width={56}
              height={56}
              priority
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          </div>
          <h1 className="text-pretty text-[clamp(2.25rem,8vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.045em] text-[var(--on-surface)]">
            <span className="block">Institutional</span>
            <span className="block text-[var(--on-surface-variant)]">Awareness</span>
          </h1>

          <p className="mx-auto mt-8 max-w-[28rem] text-pretty text-[15px] leading-relaxed text-muted sm:mt-10">
            Observations, assessments, and leadership signals in one place—so your school can act
            with evidence, not guesswork.
          </p>

          <div className="mt-12 flex flex-col items-center sm:mt-14">
            <div
              className="mb-6 h-px w-12 bg-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)]"
              aria-hidden
            />
            <Link
              href="/login"
              className="group relative inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--on-surface)] px-9 text-[13px] font-medium tracking-[-0.015em] text-[var(--surface-bright)] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-6px_rgba(0,0,0,0.18)] outline-none ring-1 ring-black/[0.04] transition-[transform,box-shadow,opacity] duration-200 hover:opacity-[0.94] hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_14px_36px_-8px_rgba(0,0,0,0.22)] focus-visible:ring-2 focus-visible:ring-[var(--on-surface)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-bright)] active:scale-[0.985] motion-reduce:transition-none motion-reduce:hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-6px_rgba(0,0,0,0.18)]"
            >
              Sign in
              <svg
                className="h-[15px] w-[15px] shrink-0 opacity-80 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                viewBox="0 0 15 15"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 7.5h8m0 0L8.5 4M11 7.5 8.5 11"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <p className="mt-5 max-w-[17rem] text-center text-[11px] leading-[1.45] text-muted/60">
              For existing schools. Continue with your school-issued email.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
