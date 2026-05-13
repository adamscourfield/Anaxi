import Link from "next/link";
import Image from "next/image";
import { GodSchoolSwitcher } from "@/components/god-school-switcher";

export default function GodLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}>
      <header className="fixed top-0 w-full z-50 flex h-14 items-center justify-between border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[var(--anx-frost-bg)] px-6 shadow-none backdrop-blur-[14px]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/anaxi-logo.png" alt="Anaxi" width={28} height={28} priority className="h-7 w-7 object-contain" />
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--on-surface-variant)" }}>
              God Mode
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/god"
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-surface-container"
              style={{ color: "var(--on-surface-variant)" }}
            >
              Schools
            </Link>
            <Link
              href="/god/audit"
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-surface-container"
              style={{ color: "var(--on-surface-variant)" }}
            >
              Audit log
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <GodSchoolSwitcher />
          <Link
            href="/home"
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-surface-container"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Exit God Mode
          </Link>
          <Link
            href="/login/sign-out?callbackUrl=/login&returnTo=/home"
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-surface-container"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Log out
          </Link>
        </div>
      </header>
      <main className="anx-workspace-main mx-auto w-full max-w-[1400px] px-6 pt-20 pb-10">
        {children}
      </main>
    </div>
  );
}
