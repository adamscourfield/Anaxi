export function SkipToContent({
  targetId,
  label = "Skip to main content",
}: {
  targetId: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-[var(--on-surface)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[var(--on-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--on-surface)] focus:ring-offset-2"
    >
      {label}
    </a>
  );
}
