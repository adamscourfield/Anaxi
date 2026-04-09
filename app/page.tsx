import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16 font-sans">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, color-mix(in srgb, var(--brand-blue-border) 35%, transparent), transparent 55%),
            radial-gradient(ellipse 90% 60% at 100% 60%, color-mix(in srgb, var(--coral-border) 18%, transparent), transparent 50%),
            radial-gradient(ellipse 70% 50% at 0% 80%, color-mix(in srgb, var(--brand-blue-soft) 80%, transparent), transparent 45%),
            var(--surface-bright)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(var(--outline-variant) 1px, transparent 1px),
            linear-gradient(90deg, var(--outline-variant) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 70% at 50% 45%, black 20%, transparent 70%)",
        }}
      />

      <div
        className="relative z-10 flex w-full max-w-[420px] flex-col items-center rounded-[2rem] px-8 py-12 text-center sm:px-12 sm:py-14"
        style={{
          background: "color-mix(in srgb, var(--surface-container-lowest) 72%, transparent)",
          border: "1px solid color-mix(in srgb, var(--outline-variant) 45%, transparent)",
          boxShadow: "var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--surface-container-lowest) 50%, transparent) inset",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div
          className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl"
          style={{
            background: "color-mix(in srgb, var(--surface-container-low) 90%, var(--surface-container-lowest))",
            border: "1px solid color-mix(in srgb, var(--outline-variant) 35%, transparent)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Image
            src="/anaxi-logo.png"
            alt=""
            width={52}
            height={52}
            priority
            className="h-[3.25rem] w-[3.25rem] object-contain"
          />
        </div>

        <h1 className="mt-9 text-5xl font-bold tracking-[-0.04em] text-[var(--on-surface)] sm:text-6xl sm:tracking-[-0.045em]">
          Anaxi
        </h1>

        <span
          className="mt-4 block h-px w-12 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary-container) 55%, transparent), transparent)",
          }}
          aria-hidden
        />

        <p
          className="mt-5 max-w-[280px] text-[15px] font-medium leading-relaxed sm:text-base"
          style={{ color: "var(--on-surface-variant)" }}
        >
          Institutional intelligence for schools.
        </p>

        <Link
          href="/login"
          className="mt-10 inline-flex min-h-[3rem] w-full max-w-[240px] items-center justify-center rounded-2xl px-8 text-[15px] font-semibold text-white calm-transition hover:opacity-[0.92] active:scale-[0.98]"
          style={{
            background: "var(--primary-container)",
            boxShadow:
              "0 1px 2px color-mix(in srgb, var(--primary-container) 40%, transparent), 0 8px 24px -4px color-mix(in srgb, var(--primary-container) 45%, transparent)",
          }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
