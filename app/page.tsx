import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
          <h1 className="text-pretty text-[clamp(2.25rem,8vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.045em] text-[var(--on-surface)]">
            <span className="block">Institutional</span>
            <span className="block text-[var(--on-surface-variant)]">Awareness</span>
          </h1>

          <p className="mx-auto mt-8 max-w-[28rem] text-pretty text-[15px] leading-relaxed text-muted sm:mt-10">
            Observations, assessments, and leadership signals in one place—so your school can act
            with evidence, not guesswork.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:mt-12">
            <Button asChild className="min-w-[11rem]">
              <Link href="/login">Sign in</Link>
            </Button>
            <p className="max-w-sm text-pretty text-[12px] leading-relaxed text-muted/75">
              Use your work email if your school already uses Anaxi.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
