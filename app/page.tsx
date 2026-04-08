import Image from "next/image";
import Link from "next/link";

function LandingPreviewDecor() {
  const barHeights = [42, 68, 38, 82, 54, 71];
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      {/* Primary preview panel — matches floating card framing from login */}
      <div
        className="relative rounded-[1.5rem] p-1 shadow-[0_32px_64px_-16px_rgba(25,28,30,0.06)]"
        style={{
          background: "rgba(255,255,255,0.80)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div
          className="overflow-hidden rounded-[1.375rem] p-6 sm:p-8"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid color-mix(in srgb, var(--outline-variant) 10%, transparent)",
          }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div
              className="h-2.5 w-24 rounded-full sm:w-32"
              style={{ background: "var(--surface-container-high)" }}
            />
            <div className="ml-auto flex gap-2">
              <span
                className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
                style={{ background: "var(--surface-container)" }}
              />
              <span
                className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
                style={{ background: "color-mix(in srgb, var(--brand-blue-border) 35%, var(--surface-container-low))" }}
              />
            </div>
          </div>

          <div
            className="mb-6 flex h-40 items-end gap-2 rounded-xl px-3 pb-3 pt-6 sm:h-48 sm:gap-2.5"
            style={{
              background: "color-mix(in srgb, var(--surface-container-low) 75%, transparent)",
            }}
          >
            {barHeights.map((pct, i) => (
              <div key={i} className="flex min-h-0 flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t-md calm-transition"
                  style={{
                    height: `${pct}%`,
                    minHeight: "18%",
                    background:
                      i % 3 === 0
                        ? "linear-gradient(180deg, color-mix(in srgb, var(--brand-blue-border) 85%, transparent), color-mix(in srgb, var(--primary-container) 25%, transparent))"
                        : i % 3 === 1
                          ? "linear-gradient(180deg, color-mix(in srgb, var(--coral-border) 90%, transparent), color-mix(in srgb, var(--tertiary-container) 12%, transparent))"
                          : "linear-gradient(180deg, var(--surface-container-high), var(--surface-container))",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[0.72, 0.45, 0.88].map((fill, row) => (
              <div
                key={row}
                className="flex items-center gap-3 rounded-xl px-3 py-3 shadow-ambient sm:px-4"
                style={{
                  background: "color-mix(in srgb, var(--surface-container-low) 55%, var(--surface-container-lowest))",
                  border: "1px solid color-mix(in srgb, var(--outline-variant) 12%, transparent)",
                }}
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-full sm:h-11 sm:w-11"
                  style={{
                    background:
                      row === 0
                        ? "color-mix(in srgb, var(--brand-blue-soft) 100%, var(--surface-container))"
                        : row === 1
                          ? "color-mix(in srgb, var(--coral-soft) 100%, var(--surface-container))"
                          : "var(--surface-container-high)",
                  }}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div
                    className="h-2 max-w-[70%] rounded-full"
                    style={{ background: "var(--surface-container-high)" }}
                  />
                  <div className="h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                    <div
                      className="h-full rounded-full calm-transition"
                      style={{
                        width: `${Math.round(fill * 100)}%`,
                        background:
                          row === 1
                            ? "linear-gradient(90deg, var(--coral-border), color-mix(in srgb, var(--coral) 40%, transparent))"
                            : "linear-gradient(90deg, var(--brand-blue-border), color-mix(in srgb, var(--brand-blue) 35%, transparent))",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offset floater — echoes home dashboard cards */}
      <div
        className="absolute -bottom-6 -left-2 w-[52%] max-w-[200px] rounded-xl p-1 shadow-float sm:-left-4 sm:max-w-[220px]"
        style={{
          background: "color-mix(in srgb, var(--surface-container-lowest) 88%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          className="rounded-[0.625rem] p-4"
          style={{
            background: "var(--surface-container-lowest)",
            border: "1px solid color-mix(in srgb, var(--outline-variant) 14%, transparent)",
          }}
        >
          <div className="mb-3 flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-7 flex-1 rounded-md"
                style={{
                  background: "var(--surface-container)",
                  opacity: 0.35 + i * 0.14,
                }}
              />
            ))}
          </div>
          <div
            className="h-px w-full"
            style={{ background: "var(--divider-subtle)" }}
          />
          <div className="mt-3 flex items-end gap-0.5">
            {[12, 20, 14, 28, 18, 24, 16, 30, 22].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}px`,
                  background:
                    i === 7
                      ? "color-mix(in srgb, var(--brand-blue-border) 70%, var(--surface-container-high))"
                      : "var(--surface-container-high)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      <nav className="fixed top-0 z-50 flex h-20 w-full items-center justify-between px-6 sm:px-8 glass-surface">
        <div className="flex items-center gap-3">
          <Image
            src="/anaxi-logo.png"
            alt="Anaxi"
            width={32}
            height={32}
            priority
            className="h-8 w-8 object-contain"
          />
          <div className="mx-2 h-4 w-px" style={{ background: "var(--divider-subtle)" }} />
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Anaxi
          </span>
        </div>
      </nav>

      <main className="flex flex-1 flex-col justify-center px-6 pb-12 pt-24 sm:px-8 sm:pb-16 sm:pt-28">
        <div className="mx-auto grid w-full max-w-5xl gap-12 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:items-center lg:gap-16">
          <div
            className="flex flex-col justify-center rounded-2xl px-2 py-4 sm:px-4 lg:rounded-3xl lg:px-8 lg:py-10"
            style={{
              background:
                "color-mix(in srgb, var(--surface-container-low) 55%, transparent)",
            }}
          >
            <div className="mx-auto flex w-full max-w-md flex-col gap-5 lg:mx-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Institutional intelligence
              </p>
              <h1 className="font-newsreader text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.08]">
                Anaxi
              </h1>
              <div
                className="flex gap-2"
                aria-hidden
              >
                <span
                  className="h-1 w-14 rounded-full sm:w-16"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--primary-container), color-mix(in srgb, var(--brand-blue) 45%, transparent))",
                  }}
                />
                <span
                  className="h-1 w-6 rounded-full opacity-50"
                  style={{ background: "var(--surface-container-high)" }}
                />
              </div>

              <div className="flex w-full max-w-xs flex-col gap-3 pt-2">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl px-8 text-base font-semibold text-white calm-transition hover:opacity-90"
                  style={{ background: "var(--primary-container)" }}
                >
                  Sign in
                </Link>
                <Link
                  href="/login/forgot-password"
                  className="text-center text-sm font-medium calm-transition sm:text-left"
                  style={{ color: "var(--on-surface-variant)" }}
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[280px] items-center justify-center lg:min-h-[420px]">
            <LandingPreviewDecor />
          </div>
        </div>
      </main>
    </div>
  );
}
