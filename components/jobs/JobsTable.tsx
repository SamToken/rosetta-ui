"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
  type RowSelectionState,
  flexRender,
} from "@tanstack/react-table"
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Network, CalendarSearch, X, Trash2,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { CostDisplay } from "@/components/shared/CostDisplay"
import { formatDate, healthColor, truncate } from "@/lib/utils"
import { deleteJob } from "@/lib/api"
import type { Job } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

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
      <Tooltip>
        <TooltipTrigger className="text-left">
          <span className="font-mono text-xs text-slate-300 truncate max-w-[160px] block">
            {names[0]}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono max-w-xs break-all">
          {paths[0]}
        </TooltipContent>
      </Tooltip>
    )
  }

  const preview = names.slice(0, 2).join(", ")
  const rest = names.slice(2)

  return (
    <Tooltip>
      <TooltipTrigger className="text-left">
        <span className="font-mono text-xs text-slate-300 block max-w-[180px] truncate">
          {preview}
          {rest.length > 0 && <span className="text-slate-500"> +{rest.length}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono max-w-xs">
        <ul className="flex flex-col gap-0.5">
          {names.map((n, i) => <li key={i}>{n}</li>)}
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

const dateRangeFilter: FilterFn<Job> = (row, columnId, filterValue: [string, string]) => {
  const [from, to] = filterValue
  const val = row.getValue<string>(columnId).slice(0, 16)
  if (from && val < from) return false
  if (to && val > to) return false
  return true
}

interface JobsTableProps {
  jobs: Job[]
  onRowClick?: (job: Job) => void
}

export function JobsTable({ jobs, onRowClick }: JobsTableProps) {
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null) // IDs en attente de confirm

  function applyDateFilter(from: string, to: string) {
    setColumnFilters(prev => {
      const without = prev.filter(f => f.id !== "created_at")
      if (!from && !to) return without
      return [...without, { id: "created_at", value: [from, to] }]
    })
  }

  function clearDates() {
    setDateFrom(""); setDateTo("")
    applyDateFilter("", "")
  }

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => deleteJob(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      setRowSelection({})
      setConfirmIds(null)
    },
  })

  const columns = useMemo<ColumnDef<Job>[]>(() => [
    {
      id: "select",
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="cursor-pointer accent-blue-500"
          onClick={e => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="cursor-pointer accent-blue-500"
          onClick={e => e.stopPropagation()}
        />
      ),
    },
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
          <TooltipContent side="right" className="bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono">
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
      filterFn: dateRangeFilter,
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
      header: () => (
        <Tooltip>
          <TooltipTrigger>
            <span className="cursor-help border-b border-dotted border-slate-600">N</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-slate-800 border-slate-700 text-slate-200 text-xs">
            Nombre de fichiers scannés
          </TooltipContent>
        </Tooltip>
      ),
      accessorFn: row => row.result?.total_files ?? -1,
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ row }) => {
        if (!row.original.result) {
          return (
            <span className="text-xs text-slate-600 italic" title="Scan importé avant Rosetta Cockpit">
              ancien
            </span>
          )
        }
        return (
          <span className="text-sm text-slate-300 tabular-nums">
            {row.original.result.total_files}
          </span>
        )
      },
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
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {hasBrief && (
              <Link href={`/jobs/${job.job_id}/brief`}
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap transition-colors">
                Vue PO
              </Link>
            )}
            {hasGraph && (
              <Link href={`/jobs/${job.job_id}/graph`}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 whitespace-nowrap transition-colors">
                <Network className="h-3 w-3" />
                Graphe
              </Link>
            )}
          </div>
        )
      },
    },
    {
      id: "delete",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); setConfirmIds([row.original.job_id]) }}
          className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
          title="Supprimer ce job"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ], [])

  const table = useReactTable({
    data: jobs,
    columns,
    state: { sorting, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    enableRowSelection: true,
    getRowId: row => row.job_id,
  })

  const selectedIds = Object.keys(rowSelection)
  const totalRows = table.getPreFilteredRowModel().rows.length
  const filteredRows = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const hasDateFilter = dateFrom || dateTo

  return (
    <div className="rounded-md border border-slate-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-800 bg-slate-900/50 flex-wrap">
        <CalendarSearch className="h-3.5 w-3.5 text-slate-500 shrink-0" />
        <div className="flex items-center gap-2">
          <input type="datetime-local" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); applyDateFilter(e.target.value, dateTo) }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 [color-scheme:dark]"
          />
          <span className="text-slate-600 text-xs">→</span>
          <input type="datetime-local" value={dateTo}
            onChange={e => { setDateTo(e.target.value); applyDateFilter(dateFrom, e.target.value) }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 [color-scheme:dark]"
          />
          {hasDateFilter && (
            <button onClick={clearDates}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <X className="h-3 w-3" /> Effacer
            </button>
          )}
        </div>

        {/* Suppression groupée */}
        {selectedIds.length > 0 && (
          <button
            onClick={() => setConfirmIds(selectedIds)}
            className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/30 rounded px-2.5 py-1 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer {selectedIds.length} job{selectedIds.length > 1 ? "s" : ""}
          </button>
        )}

        <span className="ml-auto text-xs text-slate-600 tabular-nums">
          {filteredRows}/{totalRows} jobs
        </span>
      </div>

      {/* Table */}
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
                    <th key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        "px-3 py-2 text-xs text-slate-400 font-medium uppercase tracking-wide whitespace-nowrap select-none",
                        align === "right" ? "text-right" : "text-left",
                        canSort && "cursor-pointer hover:text-slate-200"
                      )}>
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
              <tr key={row.id}
                className={cn(
                  "border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer",
                  row.getIsSelected() && "bg-blue-950/20"
                )}
                onClick={() => onRowClick?.(row.original)}>
                {row.getVisibleCells().map(cell => {
                  const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align
                  return (
                    <td key={cell.id} className={cn("px-3 py-2.5", align === "right" && "text-right")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800 bg-slate-900/40">
          <span className="text-xs text-slate-600 tabular-nums">
            Page {pageIndex + 1}/{pageCount} · {Math.min(pageSize, filteredRows - pageIndex * pageSize)} affiché{filteredRows > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
              const page = pageCount <= 7 ? i : i // simplified: show all if ≤7
              return (
                <button key={i} onClick={() => table.setPageIndex(i)}
                  className={cn(
                    "w-6 h-6 rounded text-xs transition-colors",
                    pageIndex === i
                      ? "bg-blue-600 text-white font-medium"
                      : "text-slate-500 hover:text-slate-200 hover:bg-slate-800"
                  )}>
                  {i + 1}
                </button>
              )
            })}
            {pageCount > 7 && pageIndex >= 7 && (
              <span className="text-slate-600 text-xs px-1">…{pageIndex + 1}</span>
            )}
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Dialog de confirmation suppression */}
      {confirmIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-slate-100 font-semibold">
                Supprimer {confirmIds.length} job{confirmIds.length > 1 ? "s" : ""} ?
              </p>
              <p className="text-slate-500 text-sm">
                Les fichiers générés seront également supprimés. Cette action est irréversible.
              </p>
            </div>
            {deleteMutation.isError && (
              <p className="text-red-400 text-xs">
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Erreur"}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setConfirmIds(null); deleteMutation.reset() }}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 rounded text-sm border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmIds)}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 rounded text-sm bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Suppression…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
