"use client"

import { useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { CostDisplay } from "@/components/shared/CostDisplay"
import { flagsColor, formatDuration, formatLines, truncate } from "@/lib/utils"
import type { FileSummary, FileSummaryStatus } from "@/lib/types"

interface HeatmapGridProps {
  files: FileSummary[]
}

interface DrawerFile extends FileSummary {}

function fileStatusToJobStatus(s: FileSummaryStatus) {
  // FileSummaryStatus est un sous-ensemble de JobStatus
  return s === "no_llm" ? ("success" as const) : s
}

export function HeatmapGrid({ files }: HeatmapGridProps) {
  const [selected, setSelected] = useState<DrawerFile | null>(null)

  if (files.length <= 1) return null

  return (
    <>
      <div
        className="grid gap-2 p-1"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        }}
      >
        {files.map((file) => {
          const bg = flagsColor(file.flags_total)
          const shortName = truncate(file.filename.replace(/\.php$/, ""), 14)

          return (
            <Tooltip key={file.filename}>
              <TooltipTrigger
                onClick={() => setSelected(file)}
                className="flex flex-col items-start gap-0.5 rounded p-2 text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ backgroundColor: bg }}
              >
                <span className="truncate w-full text-xs font-semibold text-black/80">
                  {shortName}
                </span>
                <span className="text-[10px] text-black/70">
                  {file.flags_total} flags
                </span>
                <span className="text-[10px] text-black/60">
                  {formatLines(file.file_size_lines)} L
                </span>
              </TooltipTrigger>
              <TooltipContent
                className="bg-slate-800 border-slate-700 text-slate-200 text-xs"
                side="top"
              >
                <p className="font-semibold">{file.filename}</p>
                <p>{file.flags_total} flags · {formatLines(file.file_size_lines)} lignes</p>
                <p>{file.insights_total} insights</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <Drawer open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DrawerContent className="bg-slate-900 border-slate-800">
          <DrawerHeader>
            <DrawerTitle className="font-mono text-sm text-slate-200 break-all">
              {selected?.filename}
            </DrawerTitle>
          </DrawerHeader>
          {selected && (
            <div className="px-6 pb-8 grid grid-cols-2 gap-4 text-sm">
              <Detail label="Flags totaux" value={String(selected.flags_total)} />
              <Detail label="Lignes" value={formatLines(selected.file_size_lines)} />
              <Detail label="Insights" value={String(selected.insights_total)} />
              <Detail label="Durée" value={formatDuration(selected.processing_time_seconds)} />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Coût LLM</span>
                <CostDisplay usd={selected.llm_cost_usd} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
                <JobStatusBadge status={fileStatusToJobStatus(selected.status)} />
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="font-semibold text-slate-200">{value}</span>
    </div>
  )
}
