import { ButtonHTMLAttributes, cloneElement, forwardRef, isValidElement, ReactElement } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "tertiary";

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold tracking-[0.01em] calm-transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const variantClasses: Record<Variant, string> = {
  // Primary: deep slate gradient (per "Glass & Gradient" rule)
  primary:
    "py-2.5 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] text-[var(--on-primary)] shadow-none hover:opacity-95 motion-safe:active:scale-[0.98]",
  // Secondary: secondary-container background, calm alternative
  secondary:
    "py-2.5 bg-[var(--secondary-container)] text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] motion-safe:active:scale-[0.98]",
  // Ghost: transparent, minimal
  ghost:
    "py-2.5 bg-transparent text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)] motion-safe:active:scale-[0.98]",
  // Danger: coral for destructive actions
  danger:
    "py-2.5 bg-[var(--danger-btn)] text-on-primary shadow-none hover:bg-[var(--danger-btn-hover)] motion-safe:active:scale-[0.98] active:bg-[var(--danger-btn-active)]",
  // Tertiary: coral — only for critical "single point of truth" actions
  tertiary:
    "py-2.5 bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] shadow-none hover:opacity-95 motion-safe:active:scale-[0.98]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
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
    return cloneElement(ch, { ...ch.props, ref, className: merged } as never);
  }
  return (
    <button ref={ref} {...props} className={`${baseClass} ${variantClasses[variant]} ${className}`}>
      {children}
    </button>
  );
});
