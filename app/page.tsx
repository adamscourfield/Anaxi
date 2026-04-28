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

      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)] px-4 shadow-header glass-surface sm:px-6 lg:px-10">
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
        <div className="mx-auto w-full max-w-[720px] text-center">
          <div className="mb-8 flex items-center justify-center gap-4 sm:mb-10">
            <span className="h-px w-10 shrink-0 bg-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)]" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">
              Institutional grade software
            </p>
            <span className="h-px w-10 shrink-0 bg-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)]" aria-hidden />
          </div>

          <h1 className="text-pretty text-[clamp(1.75rem,4.5vw,2.625rem)] font-bold leading-[1.12] tracking-[-0.035em]">
            <span className="text-[var(--on-surface)]">Operational clarity.</span>{" "}
            <span className="text-[var(--on-surface-variant)]">Pedagogical precision.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[34rem] text-pretty text-[15px] leading-relaxed text-muted">
            One calm workspace for observations, assessments, leave, and leadership signals—built for
            schools that need decisions to be traceable, fast, and grounded in evidence.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:mt-12">
            <Button asChild className="min-w-[11rem]">
              <Link href="/login">Sign in</Link>
            </Button>
            <p className="max-w-sm text-pretty text-[12px] leading-relaxed text-muted/80">
              Already using Anaxi at your school? Use your work email to continue where you left off.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
