"use client"

import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { CostDisplay } from "@/components/shared/CostDisplay"
import { formatDate, healthColor, truncate } from "@/lib/utils"
import type { Job } from "@/lib/types"
import { cn } from "@/lib/utils"

interface JobsTableProps {
  jobs: Job[]
}

export function JobsTable({ jobs }: JobsTableProps) {
  const router = useRouter()

  const sorted = [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-800 hover:bg-transparent">
          <TableHead className="text-slate-400">ID</TableHead>
          <TableHead className="text-slate-400">Status</TableHead>
          <TableHead className="text-slate-400">Date</TableHead>
          <TableHead className="text-right text-slate-400">Fichiers</TableHead>
          <TableHead className="text-right text-slate-400">Score</TableHead>
          <TableHead className="text-right text-slate-400">Coût</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((job) => (
          <TableRow
            key={job.job_id}
            className="cursor-pointer border-slate-800 hover:bg-slate-800/50"
            onClick={() => router.push(`/jobs/${job.job_id}`)}
          >
            <TableCell className="font-mono text-xs text-slate-300">
              {truncate(job.job_id, 12)}
            </TableCell>
            <TableCell>
              <JobStatusBadge status={job.status} />
            </TableCell>
            <TableCell className="text-sm text-slate-400">
              {formatDate(job.created_at)}
            </TableCell>
            <TableCell className="text-right text-sm text-slate-300">
              {job.result?.total_files ?? "—"}
            </TableCell>
            <TableCell className="text-right">
              {job.result != null ? (
                <span className={cn("text-sm font-semibold tabular-nums", healthColor(job.result.health_score))}>
                  {job.result.health_score}
                  <span className="text-slate-600">/100</span>
                </span>
              ) : (
                <span className="text-slate-600 text-sm">—</span>
              )}
            </TableCell>
            <TableCell className="text-right text-sm">
              {job.result != null ? (
                <CostDisplay usd={job.result.total_cost_usd} />
              ) : (
                <span className="text-slate-600">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
