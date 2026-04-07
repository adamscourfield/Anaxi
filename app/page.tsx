import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      className="relative h-dvh min-h-0 overflow-hidden"
      style={{ color: "var(--on-surface)" }}
    >
      {/* Base + subtle vertical wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, var(--surface-bright) 0%, var(--surface-container-low) 45%, var(--surface-bright) 100%)",
        }}
      />
      {/* Large ambient orbs */}
      <div
        className="pointer-events-none absolute -top-32 right-[12%] h-[min(52vw,420px)] w-[min(52vw,420px)] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "var(--primary-container)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-24 h-[min(70vw,480px)] w-[min(70vw,480px)] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "var(--brand-blue)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-[min(90vw,560px)] w-[min(90vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "var(--primary-container)" }}
        aria-hidden
      />
      {/* Fine grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(var(--outline-variant) 0.5px, transparent 0.5px),
            linear-gradient(90deg, var(--outline-variant) 0.5px, transparent 0.5px)
          `,
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      {/* Top edge highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--outline-variant), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 py-8">
        <div
          className="flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border px-8 py-10 shadow-[0_24px_80px_-24px_rgba(19,27,46,0.12)] backdrop-blur-md sm:px-12 sm:py-12"
          style={{
            background: "rgba(255, 255, 255, 0.72)",
            borderColor: "rgba(198, 198, 205, 0.55)",
          }}
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <div
              className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl"
              style={{
                background:
                  "linear-gradient(145deg, var(--surface-container-lowest) 0%, var(--surface-container-low) 100%)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.9) inset, 0 12px 40px -12px rgba(19,27,46,0.2)",
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-40"
                style={{
                  background:
                    "radial-gradient(circle at 30% 25%, rgba(99,102,241,0.15), transparent 55%)",
                }}
                aria-hidden
              />
              <Image
                src="/anaxi-logo.png"
                alt="Anaxi"
                width={56}
                height={56}
                priority
                className="relative z-[1] h-14 w-14 object-contain"
              />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--on-surface-variant)]">
              Institutional intelligence
            </p>
            <h1 className="font-newsreader text-3xl font-semibold tracking-tight text-[var(--on-surface)] sm:text-4xl">
              Anaxi
            </h1>
          </div>

          <div className="flex w-full max-w-[280px] flex-col items-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--primary-container)] px-8 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              href="/login/forgot-password"
              className="text-sm font-medium text-[var(--on-surface-variant)] transition-colors hover:text-[var(--on-surface)]"
            >
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
