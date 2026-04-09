import Link from "next/link";

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[var(--outline-variant)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-semibold text-[var(--on-surface)] tracking-tight">
          Anaxi
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-6">
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
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors duration-150"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--primary-container)] text-white text-sm font-medium hover:opacity-90 transition-opacity duration-150"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
