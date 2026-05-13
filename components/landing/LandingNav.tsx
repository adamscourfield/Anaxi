import Image from "next/image";
import Link from "next/link";

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[var(--outline-variant)]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo + wordmark */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/anaxi-logo.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-[var(--on-surface)]">
            Anaxi
          </span>
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="#core"
            className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors duration-150"
          >
            Core
          </Link>
          <Link
            href="#learn"
            className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors duration-150"
          >
            Learn
          </Link>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            style={{ background: "var(--primary-container)" }}
          >
            Request Demo
          </Link>
        </div>
      </div>
    </header>
  );
}
