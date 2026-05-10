"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table"
import { ChevronUp, ChevronDown, ChevronsUpDown, Network } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { CostDisplay } from "@/components/shared/CostDisplay"
import { formatDate, healthColor, truncate } from "@/lib/utils"
import type { Job } from "@/lib/types"
import { cn } from "@/lib/utils"

function RiskBadge({ score }: { score: number }) {
  if (score >= 70) return <span className="text-[10px] text-green-500/70 font-medium">Faible</span>
  if (score >= 40) return <span className="text-[10px] text-orange-500/70 font-medium">Modéré</span>
  return <span className="text-[10px] text-red-500/70 font-medium">Critique</span>
}

function FilesCell({ job }: { job: Job }) {
  const paths = job.result?.php_paths ?? []
  const names = paths.map(p => p.split("/").pop() ?? p)
  if (names.length === 0) return <span className="text-slate-600">—</span>

  if (names.length === 1) {
    return (
      <span className="font-mono text-xs text-slate-300 truncate max-w-[160px] block">
        {names[0]}
      </span>
    )
  }

  const preview = names.slice(0, 2).join(", ")
  const rest = names.slice(2)

  return (
    <Tooltip>
      <TooltipTrigger className="text-left">
        <span className="font-mono text-xs text-slate-300 block max-w-[180px] truncate">
          {preview}
          {rest.length > 0 && (
            <span className="text-slate-500"> +{rest.length}</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono max-w-xs"
      >
        <ul className="flex flex-col gap-0.5">
          {names.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (!sorted) return <ChevronsUpDown className="h-3 w-3 inline-block ml-1 text-slate-700" />
  if (sorted === "asc") return <ChevronUp className="h-3 w-3 inline-block ml-1 text-slate-300" />
  return <ChevronDown className="h-3 w-3 inline-block ml-1 text-slate-300" />
}

interface JobsTableProps {
  jobs: Job[]
  onRowClick?: (job: Job) => void
}

export function JobsTable({ jobs, onRowClick }: JobsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ])

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      {
        id: "job_id",
        header: "ID",
        accessorFn: row => row.job_id,
        enableSorting: false,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger className="cursor-pointer font-mono text-xs text-slate-300">
              {truncate(row.original.job_id, 12)}
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono"
            >
              {row.original.job_id}
            </TooltipContent>
          </Tooltip>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: row => row.status,
        enableSorting: true,
        cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
      },
      {
        id: "created_at",
        header: "Date",
        accessorFn: row => row.created_at,
        enableSorting: true,
        sortingFn: "datetime",
        cell: ({ row }) => (
          <span className="text-sm text-slate-400">{formatDate(row.original.created_at)}</span>
        ),
      },
      {
        id: "files",
        header: "Fichiers scannés",
        accessorFn: row => row.result?.total_files ?? 0,
        enableSorting: true,
        cell: ({ row }) => <FilesCell job={row.original} />,
      },
      {
        id: "total_files",
        header: "N",
        accessorFn: row => row.result?.total_files ?? 0,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="text-sm text-slate-300 tabular-nums">
            {row.original.result?.total_files ?? "—"}
          </span>
        ),
      },
      {
        id: "health_score",
        header: "Score",
        accessorFn: row => row.result?.health_score ?? -1,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => {
          const job = row.original
          const hasLlm = job.result != null && job.result.files.some(f => f.status !== "no_llm")
          const score = job.result?.health_score
          if (!hasLlm || score == null) return <span className="text-slate-600 text-sm">—</span>
          return (
            <div className="flex flex-col items-end gap-0">
              <span className={cn("text-sm font-semibold tabular-nums", healthColor(score))}>
                {score}<span className="text-slate-600">/100</span>
              </span>
              <RiskBadge score={score} />
            </div>
          )
        },
      },
      {
        id: "cost",
        header: "Coût",
        accessorFn: row => row.result?.total_cost_usd ?? 0,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.result != null ? (
            <CostDisplay usd={row.original.result.total_cost_usd} />
          ) : (
            <span className="text-slate-600">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const job = row.original
          const hasLlm = job.result != null && job.result.files.some(f => f.status !== "no_llm")
          const hasBrief = job.status === "success" && hasLlm
          const hasGraph = job.status === "success" && (job.result?.total_files ?? 0) >= 1
          return (
            <div
              className="flex items-center gap-2"
              onClick={e => e.stopPropagation()}
            >
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
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: jobs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-md border border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-slate-800/70 border-b border-slate-700">
                {hg.headers.map(header => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        "px-3 py-2 text-xs text-slate-400 font-medium uppercase tracking-wide whitespace-nowrap select-none",
                        align === "right" ? "text-right" : "text-left",
                        canSort && "cursor-pointer hover:text-slate-200"
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && <SortIcon sorted={sorted} />}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer"
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map(cell => {
                  const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align
                  return (
                    <td
                      key={cell.id}
                      className={cn("px-3 py-2.5", align === "right" && "text-right")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
