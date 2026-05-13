import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // ── Design System: The Modern Academic Ledger ──────────────
        // Primary
        primary:              "var(--primary)",
        "primary-container":  "var(--primary-container)",
        "on-primary":         "var(--on-primary)",
        "on-primary-container": "var(--on-primary-container)",
        "primary-fixed":      "var(--primary-fixed)",
        "primary-fixed-dim":  "var(--primary-fixed-dim)",
        "inverse-primary":    "var(--inverse-primary)",

        // Secondary
        secondary:            "var(--secondary)",
        "secondary-container":"var(--secondary-container)",
        "on-secondary":       "var(--on-secondary)",
        "on-secondary-container": "var(--on-secondary-container)",

        // Tertiary / Coral
        tertiary:             "var(--tertiary)",
        "tertiary-container": "var(--tertiary-container)",
        "on-tertiary":        "var(--on-tertiary)",
        "on-tertiary-container": "var(--on-tertiary-container)",
        "tertiary-fixed":     "var(--tertiary-fixed)",
        "tertiary-fixed-dim": "var(--tertiary-fixed-dim)",

        // Surfaces
        background:           "var(--background)",
        "surface-bright":     "var(--surface-bright)",
        "surface-dim":        "var(--surface-dim)",
        "surface-container-lowest": "var(--surface-container-lowest)",
        "surface-container-low":    "var(--surface-container-low)",
        "surface-container":        "var(--surface-container)",
        "surface-container-high":   "var(--surface-container-high)",
        "surface-container-highest":"var(--surface-container-highest)",
        "surface-variant":    "var(--surface-variant)",
        "inverse-surface":    "var(--inverse-surface)",
        "inverse-on-surface": "var(--inverse-on-surface)",

        // On-surface
        "on-surface":         "var(--on-surface)",
        "on-surface-variant": "var(--on-surface-variant)",
        "on-background":      "var(--on-background)",
        outline:              "var(--outline)",
        "outline-variant":    "var(--outline-variant)",

        // Error
        "error-container":    "var(--error-container)",
        "on-error":           "var(--on-error)",
        "on-error-container": "var(--on-error-container)",

        // ── CSS variable aliases (legacy pattern preserved) ──────────
        bg:           "var(--surface-bright)",
        surface:      "var(--surface-container-lowest)",
        text:         "var(--on-surface)",
        muted:        "var(--on-surface-variant)",
        border:       "var(--outline-variant)",
        divider:      "var(--surface-container-low)",
        accent:       "var(--primary)",
        accentHover:  "var(--accent-hover)",
        accentActive: "var(--accent-active)",
        success:      "var(--success)",
        warning:      "var(--warning)",
        error:        "var(--error)",
        primaryBtn:       "var(--primary-btn)",
        primaryBtnHover:  "var(--primary-btn-hover)",
        primaryBtnActive: "var(--primary-btn-active)",
        borderHover:      "var(--border-hover)",
        accentSurface:    "var(--surface-container)",
        iconMuted:        "var(--on-surface-variant)",
        dangerBtn:        "var(--danger-btn)",
        dangerBtnHover:   "var(--danger-btn-hover)",
        dangerBtnActive:  "var(--danger-btn-active)",
        positive:         "var(--positive)",
        negative:         "var(--negative)",
        toggleOff:        "var(--toggle-off)",

        // ── Brand palette — direct values ──────────────────────────
        coral:  "#fe9f9f",
        // Merge default blue scale so bg-blue-400 / text-blue-700 etc. work;
        // a plain string here replaced the whole palette and broke those utilities.
        blue: { ...colors.blue, DEFAULT: "#6366f1" },
        amber:  "#fdc683",

        // ── Extended tints ─────────────────────────────────────────
        "coral-10":  "rgba(254,159,159,0.10)",
        "coral-12":  "rgba(254,159,159,0.12)",
        "blue-5":    "rgba(99,102,241,0.05)",
        "blue-8":    "rgba(99,102,241,0.08)",
        "blue-16":   "rgba(99,102,241,0.16)",
        "amber-15":  "rgba(253,198,131,0.15)",

        // ── Scale — 4-level quality ratings ────────────────────────
        "scale-limited":        "var(--scale-limited)",
        "scale-limited-bg":     "var(--scale-limited-bg)",
        "scale-limited-text":   "var(--scale-limited-text)",
        "scale-limited-border": "var(--scale-limited-border)",
        "scale-limited-light":  "var(--scale-limited-light)",
        "scale-limited-bar":    "var(--scale-limited-bar)",
        "scale-some":           "var(--scale-some)",
        "scale-some-bg":        "var(--scale-some-bg)",
        "scale-some-text":      "var(--scale-some-text)",
        "scale-some-border":    "var(--scale-some-border)",
        "scale-some-light":     "var(--scale-some-light)",
        "scale-some-bar":       "var(--scale-some-bar)",
        "scale-consistent":     "var(--scale-consistent)",
        "scale-consistent-bg":  "var(--scale-consistent-bg)",
        "scale-consistent-text":"var(--scale-consistent-text)",
        "scale-consistent-border":"var(--scale-consistent-border)",
        "scale-consistent-light":"var(--scale-consistent-light)",
        "scale-consistent-bar": "var(--scale-consistent-bar)",
        "scale-strong":         "var(--scale-strong)",
        "scale-strong-bg":      "var(--scale-strong-bg)",
        "scale-strong-text":    "var(--scale-strong-text)",
        "scale-strong-border":  "var(--scale-strong-border)",
        "scale-strong-light":   "var(--scale-strong-light)",
        "scale-strong-bar":     "var(--scale-strong-bar)",

        // ── Status — pending/approved/denied ───────────────────────
        "status-pending":        "var(--status-pending)",
        "status-pending-bg":     "var(--status-pending-bg)",
        "status-pending-text":   "var(--status-pending-text)",
        "status-pending-border": "var(--status-pending-border)",
        "status-pending-light":  "var(--status-pending-light)",
        "status-approved":       "var(--status-approved)",
        "status-approved-bg":    "var(--status-approved-bg)",
        "status-approved-text":  "var(--status-approved-text)",
        "status-approved-border":"var(--status-approved-border)",
        "status-approved-light": "var(--status-approved-light)",
        "status-denied":         "var(--status-denied)",
        "status-denied-bg":      "var(--status-denied-bg)",
        "status-denied-text":    "var(--status-denied-text)",
        "status-denied-border":  "var(--status-denied-border)",
        "status-denied-light":   "var(--status-denied-light)",

        // ── Risk tiers ─────────────────────────────────────────────
        "risk-urgent-bg":    "var(--risk-urgent-bg)",
        "risk-urgent-text":  "var(--risk-urgent-text)",
        "risk-priority-bg":  "var(--risk-priority-bg)",
        "risk-priority-text":"var(--risk-priority-text)",
        "risk-watch-bg":     "var(--risk-watch-bg)",
        "risk-watch-text":   "var(--risk-watch-text)",
        "risk-stable-bg":    "var(--risk-stable-bg)",
        "risk-stable-text":  "var(--risk-stable-text)",

        // ── Severity ───────────────────────────────────────────────
        "severity-low-bg":       "var(--severity-low-bg)",
        "severity-low-text":     "var(--severity-low-text)",
        "severity-medium-bg":    "var(--severity-medium-bg)",
        "severity-medium-text":  "var(--severity-medium-text)",
        "severity-medium-dot":   "var(--severity-medium-dot)",
        "severity-high-bg":      "var(--severity-high-bg)",
        "severity-high-text":    "var(--severity-high-text)",
        "severity-high-dot":     "var(--severity-high-dot)",
        "severity-critical-bg":  "var(--severity-critical-bg)",
        "severity-critical-text":"var(--severity-critical-text)",
        "severity-critical-dot": "var(--severity-critical-dot)",

        // ── Lesson phases ──────────────────────────────────────────
        "phase-instruction-bg":     "var(--phase-instruction-bg)",
        "phase-instruction-text":   "var(--phase-instruction-text)",
        "phase-instruction-border": "var(--phase-instruction-border)",
        "phase-guided-bg":          "var(--phase-guided-bg)",
        "phase-guided-text":        "var(--phase-guided-text)",
        "phase-guided-border":      "var(--phase-guided-border)",
        "phase-independent-bg":     "var(--phase-independent-bg)",
        "phase-independent-text":   "var(--phase-independent-text)",
        "phase-independent-border": "var(--phase-independent-border)",
        "phase-unknown-bg":         "var(--phase-unknown-bg)",
        "phase-unknown-text":       "var(--phase-unknown-text)",
        "phase-unknown-border":     "var(--phase-unknown-border)",

        // ── Category pills ─────────────────────────────────────────
        "cat-purple-bg":  "var(--cat-purple-bg)",
        "cat-purple-text":"var(--cat-purple-text)",
        "cat-blue-bg":    "var(--cat-blue-bg)",
        "cat-blue-text":  "var(--cat-blue-text)",
        "cat-violet-bg":  "var(--cat-violet-bg)",
        "cat-violet-text":"var(--cat-violet-text)",
        "cat-indigo-bg":  "var(--cat-indigo-bg)",
        "cat-indigo-text":"var(--cat-indigo-text)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-lg)",
        "2xl": "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm:      "var(--shadow-sm)",
        md:      "var(--shadow-md)",
        lg:      "var(--shadow-lg)",
        xl:      "var(--shadow-xl)",
        ambient: "var(--shadow-ambient)",
        float:   "var(--shadow-float)",
        header:  "var(--shadow-header)",
      },
      transitionTimingFunction: {
        calm: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
        220: "220ms",
        hvqt: "300ms",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.4" }],
        "xs":  ["0.75rem",   { lineHeight: "1.4",  letterSpacing: "0.01em" }],
        "sm":  ["0.875rem",  { lineHeight: "1.5",  letterSpacing: "0.005em" }],
        "base":["1rem",      { lineHeight: "1.6" }],
        "lg":  ["1.125rem",  { lineHeight: "1.5",  letterSpacing: "-0.01em" }],
        "xl":  ["1.25rem",   { lineHeight: "1.4",  letterSpacing: "-0.015em" }],
        "2xl": ["1.5rem",    { lineHeight: "1.3",  letterSpacing: "-0.02em" }],
        "3xl": ["1.875rem",  { lineHeight: "1.2",  letterSpacing: "-0.025em" }],
        "4xl": ["2.25rem",   { lineHeight: "1.1",  letterSpacing: "-0.03em" }],
      },
      keyframes: {
        pageEnter: {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
            filter: "blur(4px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
            filter: "blur(0px)",
          },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.72" },
        },
      },
      animation: {
        "page-enter": "pageEnter 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "pulse-subtle": "pulseSubtle 1.8s ease-in-out infinite",
      },
    }
  },
  plugins: []
};

export default config;
