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

      <div className="rounded-2xl bg-surface-container-high/50 p-4 sm:p-5">
        <div className="filter-bar items-center">
          <div className="h-11 min-w-[200px] flex-1 animate-pulse rounded-xl bg-border/40" />
          <div className="h-11 w-24 animate-pulse rounded-xl bg-border/35" />
          <div className="hidden h-4 w-48 animate-pulse rounded bg-border/35 sm:ml-auto sm:block" />
        </div>
      </div>

      <div className="table-shell overflow-hidden">
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
  );
}
