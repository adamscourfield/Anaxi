"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { MetaText } from "@/components/ui/typography";

interface ImportJob {
  id: string;
  type: string;
  status: string;
  fileName: string | null;
  rowCount: number;
  rowsProcessed: number;
  rowsFailed: number;
  errorSummary: string | null;
  createdAt: string;
}

export function ImportJobHistory() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/import/jobs")
      .then((r) => r.json())
      .then((data) => {
        setJobs(data.jobs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <MetaText>Loading...</MetaText>;

  if (jobs.length === 0) {
    return <MetaText>No import jobs yet.</MetaText>;
  }

  return (
    <div className="table-shell">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="px-5 py-3.5">Date</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5 text-center">Processed</th>
              <th className="px-4 py-3.5 text-center">Failed</th>
              <th className="px-5 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="table-row calm-transition">
                <td className="px-5 py-4 text-text">{new Date(job.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-4 text-text">{job.type}</td>
                <td className="px-4 py-4 text-center">
                  <StatusPill
                    variant={
                      job.status === "COMPLETED" || job.status === "SUCCESS"
                        ? "success"
                        : job.status === "FAILED"
                          ? "error"
                          : "neutral"
                    }
                    size="sm"
                  >
                    {job.status}
                  </StatusPill>
                </td>
                <td className="px-4 py-4 text-center text-text">{job.rowsProcessed ?? job.rowCount}</td>
                <td className="px-4 py-4 text-center">
                  {job.rowsFailed > 0 ? (
                    <span className="font-medium text-error">{job.rowsFailed}</span>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-3">
                    <Link href={`/behaviour/import/job/${job.id}`} className="link-accent text-xs font-medium calm-transition">
                      View report
                    </Link>
                    {job.rowsFailed > 0 && (
                      <a
                        href={`/api/import/jobs/${job.id}/errors.csv`}
                        download
                        className="text-xs font-medium text-error hover:text-error/80 calm-transition"
                      >
                        Download errors
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
