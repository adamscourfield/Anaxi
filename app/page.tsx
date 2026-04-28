import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-bright)] text-[var(--on-surface)]">
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

      <main className="flex flex-1 flex-col lg:flex-row">
        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 md:px-8 md:py-16 lg:px-10">
          <div className="mx-auto w-full max-w-[1400px] lg:mx-0 lg:max-w-xl lg:pr-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted/70">
              Institutional grade software
            </p>
            <h1 className="mt-3 text-pretty text-[clamp(2rem,5vw,2.75rem)] font-bold leading-tight tracking-[-0.03em] text-text">
              The operational and pedagogical platform for schools that demand precision.
            </h1>
            <p className="mt-4 max-w-lg text-pretty text-[13px] leading-relaxed text-muted">
              Anaxi brings observations, assessments, leave, and leadership signals into one calm,
              auditable workspace—aligned with how your team already works.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="relative hidden min-h-[280px] flex-1 border-t border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] lg:block lg:min-h-0 lg:border-l lg:border-t-0">
          <Image
            src="/hero-network.png"
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--surface-bright)]/90 via-[var(--surface-bright)]/25 to-transparent"
            aria-hidden
          />
        </div>
      </main>
    </div>
  );
}
