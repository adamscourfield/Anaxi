import type { ReactNode } from "react";

/**
 * Shared layout for Attainment / assessment flows: light canvas + centered column.
 */
export function AttainmentPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="anx-attainment-page -mx-4 -mt-4 min-h-[calc(100vh-4rem)] bg-[#F9FAFB] px-4 pb-16 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="anx-attainment-inner mx-auto max-w-[1400px] space-y-8">{children}</div>
    </div>
  );
}
