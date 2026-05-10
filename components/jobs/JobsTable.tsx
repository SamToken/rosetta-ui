"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Network } from "lucide-react"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { CostDisplay } from "@/components/shared/CostDisplay"
import { formatDate, healthColor, truncate } from "@/lib/utils"
import type { Job } from "@/lib/types"
import { cn } from "@/lib/utils"

interface JobsTableProps {
  jobs: Job[]
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 70) return <span className="text-[10px] text-green-500/70 font-medium">Faible</span>
  if (score >= 40) return <span className="text-[10px] text-orange-500/70 font-medium">Modéré</span>
  return <span className="text-[10px] text-red-500/70 font-medium">Critique</span>
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
          <TableHead className="text-slate-400 w-16"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((job) => {
          const hasLlmScore = job.result != null &&
            job.result.files.some(f => f.status !== "no_llm")
          const hasBrief = job.status === "success" && hasLlmScore
          const hasGraph = job.status === "success" && (job.result?.total_files ?? 0) >= 1

          return (
            <TableRow
              key={job.job_id}
              className="cursor-pointer border-slate-800 hover:bg-slate-800/50"
              onClick={() => router.push(`/jobs/${job.job_id}`)}
            >
              <TableCell className="font-mono text-xs text-slate-300">
                <Tooltip>
                  <TooltipTrigger className="cursor-pointer">
                    {truncate(job.job_id, 12)}
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono"
                  >
                    {job.job_id}
                  </TooltipContent>
                </Tooltip>
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
                {hasLlmScore ? (
                  <div className="flex flex-col items-end gap-0">
                    <span className={cn("text-sm font-semibold tabular-nums", healthColor(job.result!.health_score))}>
                      {job.result!.health_score}
                      <span className="text-slate-600">/100</span>
                    </span>
                    <RiskBadge score={job.result!.health_score} />
                  </div>
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
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  {hasBrief && (
                    <Link
                      href={`/jobs/${job.job_id}/brief`}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap transition-colors"
                    >
                      Vue PO
                    </Link>
                  )}
                  {hasGraph && (
                    <Link
                      href={`/jobs/${job.job_id}/graph`}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 whitespace-nowrap transition-colors"
                    >
                      <Network className="h-3 w-3" />
                      Graphe
                    </Link>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
