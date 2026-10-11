"use client";

/**
 * A <select> that automatically submits its parent <form> on change.
 * Used to allow the department filter dropdown to apply immediately.
 */
export function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: {
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label="Department"
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        if (form) form.submit();
      }}
    >
      {children}
    </select>
  );
}
