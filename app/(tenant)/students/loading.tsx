function SkeletonRow() {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-md bg-border/60" />
          <div className="h-4 w-36 animate-pulse rounded bg-border/60" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="h-3.5 w-8 animate-pulse rounded bg-border/60" />
      </td>
      <td className="px-4 py-4">
        <div className="h-5 w-14 animate-pulse rounded-md bg-border/50" />
      </td>
      <td className="px-4 py-4">
        <div className="h-5 w-16 animate-pulse rounded-md bg-border/50" />
      </td>
      <td className="px-4 py-4">
        <div className="space-y-1.5">
          <div className="h-3 w-10 animate-pulse rounded bg-border/50" />
          <div className="h-1.5 w-24 animate-pulse rounded-full bg-border/40" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="h-3.5 w-20 animate-pulse rounded bg-border/50" />
      </td>
      <td className="px-5 py-4">
        <div className="h-3.5 w-12 animate-pulse rounded bg-border/50" />
      </td>
    </tr>
  );
}

export default function StudentsLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="h-8 w-48 animate-pulse rounded bg-border/60" />
        <div className="h-4 w-40 animate-pulse rounded bg-border/40" />
      </div>

      <div className="filter-panel">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px] flex-1 space-y-2">
            <div className="h-3 w-14 animate-pulse rounded bg-border/35" />
            <div className="h-10 w-full animate-pulse rounded-md bg-border/40" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[120px] flex-1 space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-border/35" />
              <div className="h-10 w-full animate-pulse rounded-md bg-border/40" />
            </div>
          ))}
          <div className="flex w-full gap-2 sm:w-auto lg:ml-auto">
            <div className="h-10 min-w-[140px] flex-1 animate-pulse rounded-md bg-border/45 sm:flex-none" />
            <div className="h-10 w-24 animate-pulse rounded-md bg-border/35" />
          </div>
        </div>
        <div className="mt-4 border-t border-border/20 pt-4">
          <div className="ml-auto h-4 w-56 animate-pulse rounded bg-border/30 sm:ml-auto" />
        </div>
      </div>

      <div className="table-shell overflow-hidden">
        <p className="sr-only" id="students-list-loading-scroll-hint">
          This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
        </p>
        <div className="overflow-x-auto" aria-describedby="students-list-loading-scroll-hint">
          <table className="w-full text-sm">
          <thead>
            <tr className="table-head-row text-left">
              <th className="px-5 py-4 font-semibold">Name</th>
              <th className="px-4 py-4 font-semibold">Year</th>
              <th className="px-4 py-4 font-semibold">Flags</th>
              <th className="px-4 py-4 font-semibold">Band</th>
              <th className="px-4 py-4 font-semibold">Attendance</th>
              <th className="px-4 py-4 font-semibold">Last update</th>
              <th className="px-5 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
