import { ReactNode } from "react";

function cn(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[0.8125rem] font-medium text-[var(--on-surface-variant)]">
        {label}
        {required ? (
          <span className="text-[var(--error)]" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <div className="[&_.field]:w-full" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        {children}
      </div>
      {hint ? (
        <p id={hintId} className="text-[0.75rem] leading-snug text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[0.75rem] font-medium text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
