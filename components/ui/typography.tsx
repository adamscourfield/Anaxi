import { ReactNode } from "react";

export function H1({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`font-display text-3xl font-bold leading-tight tracking-[-0.025em] text-text ${className}`}>
      {children}
    </h1>
  );
}

export function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-xl font-semibold leading-snug tracking-[-0.015em] text-text ${className}`}>{children}</h2>;
}

export function H3({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-base font-semibold leading-snug tracking-[-0.01em] text-text ${className}`}>{children}</h3>;
}

export function BodyText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm leading-relaxed text-text ${className}`}>{children}</p>;
}

export function MetaText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs leading-snug text-muted ${className}`}>{children}</p>;
}

export function Label({ children, htmlFor, className = "" }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-sm font-medium text-text ${className}`}>
      {children}
    </label>
  );
}
