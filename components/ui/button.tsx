import { ButtonHTMLAttributes, cloneElement, forwardRef, isValidElement, ReactElement } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "tertiary";

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold tracking-[0.01em] calm-transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const variantClasses: Record<Variant, string> = {
  // Redesign language (see design/anaxi_academic/DESIGN.md): flat near-black primary,
  // white outlined secondary, 10px radius (set via [data-variant] in globals.css).
  primary:
    "py-2.5 border border-[#1c1c1e] bg-[#1c1c1e] text-white hover:border-[#2e2e31] hover:bg-[#2e2e31] motion-safe:active:scale-[0.98]",
  secondary:
    "py-2.5 border border-[#d4d4d8] bg-white text-[#1c1c1e] hover:border-[#a1a1aa] hover:bg-[#f4f4f5] motion-safe:active:scale-[0.98]",
  ghost:
    "py-2.5 border border-transparent bg-transparent text-[var(--on-surface-variant)] hover:bg-[#f4f4f5] hover:text-[#1c1c1e] motion-safe:active:scale-[0.98]",
  // Danger: error red with white text for destructive actions
  danger:
    "py-2.5 border border-[var(--danger-btn)] bg-[var(--danger-btn)] text-white hover:border-[var(--danger-btn-hover)] hover:bg-[var(--danger-btn-hover)] motion-safe:active:scale-[0.98] active:bg-[var(--danger-btn-active)]",
  // Tertiary: coral — only for critical "single point of truth" actions
  tertiary:
    "py-2.5 bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] hover:opacity-95 motion-safe:active:scale-[0.98]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Merge styles onto a single child (e.g. `next/link`) instead of rendering `<button>`. */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", asChild, children, ...props },
  ref,
) {
  if (asChild && isValidElement(children)) {
    const ch = children as ReactElement<{ className?: string }>;
    const merged = `${baseClass} ${variantClasses[variant]} ${ch.props.className ?? ""} ${className}`.trim();
    return cloneElement(ch, { ...ch.props, ref, className: merged, "data-variant": variant } as never);
  }
  return (
    <button ref={ref} {...props} data-variant={variant} className={`${baseClass} ${variantClasses[variant]} ${className}`}>
      {children}
    </button>
  );
});
