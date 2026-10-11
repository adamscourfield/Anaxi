export default function LoadingClasses() {
  return <div role="status" aria-label="Loading classes" className="space-y-6 motion-safe:animate-pulse"><div className="h-24 rounded-sm bg-surface-container-low" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 rounded-sm bg-surface-container-low" />)}</div><div className="h-64 rounded-sm bg-surface-container-low" /><span className="sr-only">Loading classes…</span></div>;
}
