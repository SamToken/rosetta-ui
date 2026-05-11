"use client"

import { useState, useMemo } from "react"
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
import { flagsColor, formatDuration, formatLines } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { FileSummary, FileSummaryStatus } from "@/lib/types"
import { LayoutGrid, ListChecks, Sparkles } from "lucide-react"

// ── Niveaux de risque (alignés sur flagsColor) ─────────────────────────────

type RiskLevel = "sain" | "moyen" | "critique"
type FilterKey = "all" | RiskLevel

function riskLevel(flags: number): RiskLevel {
  if (flags <= 10) return "sain"
  if (flags <= 60) return "moyen"
  return "critique"
}

const RISK_LABEL: Record<RiskLevel, string> = {
  sain:     "✅ Sain",
  moyen:    "🟡 Modéré",
  critique: "🔴 Critique",
}

const RISK_BADGE: Record<RiskLevel, string> = {
  sain:     "text-green-400 bg-green-500/10 border-green-500/30",
  moyen:    "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  critique: "text-red-400 bg-red-500/10 border-red-500/30",
}

function fileStatusToJobStatus(s: FileSummaryStatus) {
  return s === "no_llm" ? ("success" as const) : s
}

function resolveFullPath(filename: string, phpPaths: string[]): string {
  return phpPaths.find(p => p === filename || p.endsWith("/" + filename)) ?? filename
}

// ── Props ──────────────────────────────────────────────────────────────────

interface HeatmapGridProps {
  files: FileSummary[]
  phpPaths?: string[]
  onLaunchLLM?: (paths: string[]) => void
}

// ── Composant ─────────────────────────────────────────────────────────────

export function HeatmapGrid({ files, phpPaths = [], onLaunchLLM }: HeatmapGridProps) {
  const [drawerFile, setDrawerFile] = useState<FileSummary | null>(null)
  const [mode, setMode] = useState<"grid" | "select">("grid")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (files.length <= 1) return null

  const critiquesCount = files.filter(f => riskLevel(f.flags_total) === "critique").length
  const moyenCount     = files.filter(f => riskLevel(f.flags_total) === "moyen").length
  const sainCount      = files.filter(f => riskLevel(f.flags_total) === "sain").length

  const filtered = useMemo(() =>
    files
      .filter(f => filter === "all" || riskLevel(f.flags_total) === filter)
      .sort((a, b) => b.flags_total - a.flags_total),
    [files, filter]
  )

  function toggleSelect(filename: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(filename) ? next.delete(filename) : next.add(filename)
      return next
    })
  }

  function selectAllCritiques() {
    setSelected(new Set(files.filter(f => riskLevel(f.flags_total) === "critique").map(f => f.filename)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function switchMode(m: "grid" | "select") {
    setMode(m)
    if (m === "grid") clearSelection()
  }

  function handleLaunchLLM() {
    const paths = [...selected].map(fn => resolveFullPath(fn, phpPaths))
    onLaunchLLM?.(paths)
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(f => selected.has(f.filename))
  const someFilteredSelected = filtered.some(f => selected.has(f.filename))

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(f => next.delete(f.filename))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(f => next.add(f.filename))
        return next
      })
    }
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Filtres risque */}
        <div className="flex items-center gap-1">
          {([
            { key: "all" as FilterKey,      label: `Tous (${files.length})` },
            { key: "critique" as FilterKey,  label: `🔴 Critique (${critiquesCount})` },
            { key: "moyen" as FilterKey,     label: `🟡 Modéré (${moyenCount})` },
            { key: "sain" as FilterKey,      label: `✅ Sain (${sainCount})` },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors border",
                filter === key
                  ? "bg-slate-700 text-slate-100 border-slate-600"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Toggle Grille / Sélection */}
        <div className="ml-auto flex items-center gap-0 border border-slate-700 rounded p-0.5">
          <button
            onClick={() => switchMode("grid")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors",
              mode === "grid" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <LayoutGrid className="h-3 w-3" />
            Grille
          </button>
          <button
            onClick={() => switchMode("select")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors",
              mode === "select" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <ListChecks className="h-3 w-3" />
            Sélection
          </button>
        </div>
      </div>

      {/* ── Mode Grille ── */}
      {mode === "grid" && (
        <div
          className="grid gap-2 p-1"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        >
          {filtered.map(file => {
            const bg = flagsColor(file.flags_total)
            const name = file.filename.replace(/\.php$/, "")
            return (
              <Tooltip key={file.filename}>
                <TooltipTrigger
                  onClick={() => setDrawerFile(file)}
                  className="flex flex-col items-start gap-1 rounded p-3 text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  style={{ backgroundColor: bg }}
                >
                  <span className="w-full text-xs font-semibold text-white break-words leading-tight drop-shadow-sm">{name}</span>
                  <span className="text-[11px] text-white/80">{file.flags_total} flags</span>
                  <span className="text-[11px] text-white/70">{formatLines(file.file_size_lines)} L</span>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-800 border-slate-700 text-slate-200 text-xs" side="top">
                  <p className="font-semibold">{file.filename}</p>
                  <p>{file.flags_total} flags · {formatLines(file.file_size_lines)} lignes</p>
                  <p>{file.insights_total} insights</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}

      {/* ── Mode Sélection ── */}
      {mode === "select" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {critiquesCount > 0 && (
              <button
                onClick={selectAllCritiques}
                className="text-xs text-red-400 border border-red-500/30 rounded px-2.5 py-1 hover:bg-red-500/10 transition-colors"
              >
                Tout sélectionner 🔴 ({critiquesCount})
              </button>
            )}
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Tout désélectionner
              </button>
            )}
            <span className="ml-auto text-xs text-slate-600 tabular-nums">{filtered.length} fichiers</span>
          </div>

          <div className="rounded-md border border-slate-800 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800/70 border-b border-slate-700">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected }}
                      onChange={toggleAllFiltered}
                      className="cursor-pointer accent-orange-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium uppercase tracking-wide">Fichier</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium uppercase tracking-wide">Flags</th>
                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium uppercase tracking-wide">Risque</th>
                  <th className="px-3 py-2 text-right text-xs text-slate-400 font-medium uppercase tracking-wide whitespace-nowrap">Lignes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(file => {
                  const risk = riskLevel(file.flags_total)
                  const isChecked = selected.has(file.filename)
                  return (
                    <tr
                      key={file.filename}
                      onClick={() => toggleSelect(file.filename)}
                      className={cn(
                        "border-b border-slate-800/60 cursor-pointer transition-colors",
                        isChecked ? "bg-orange-500/10" : "hover:bg-slate-800/30"
                      )}
                    >
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(file.filename)}
                          className="cursor-pointer accent-orange-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-200 max-w-[220px] truncate">
                        {file.filename.replace(/\.php$/, "")}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-sm font-semibold" style={{ color: flagsColor(file.flags_total) }}>
                        {file.flags_total}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", RISK_BADGE[risk])}>
                          {RISK_LABEL[risk]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                        {formatLines(file.file_size_lines)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Barre flottante ── */}
      {mode === "select" && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-800 border border-slate-600 shadow-2xl shadow-black/60">
            <span className="text-sm text-slate-200 font-medium tabular-nums">
              {selected.size} fichier{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
            <div className="w-px h-4 bg-slate-600" />
            <button
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleLaunchLLM}
              className="flex items-center gap-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Lancer LLM
            </button>
          </div>
        </div>
      )}

      {/* ── Drawer détail (mode grille) ── */}
      <Drawer open={drawerFile !== null} onOpenChange={open => !open && setDrawerFile(null)}>
        <DrawerContent className="bg-slate-900 border-slate-800">
          <DrawerHeader>
            <DrawerTitle className="font-mono text-sm text-slate-200 break-all">
              {drawerFile?.filename}
            </DrawerTitle>
          </DrawerHeader>
          {drawerFile && (
            <div className="px-6 pb-8 grid grid-cols-2 gap-4 text-sm">
              <Detail label="Flags totaux" value={String(drawerFile.flags_total)} />
              <Detail label="Lignes" value={formatLines(drawerFile.file_size_lines)} />
              <Detail label="Insights" value={String(drawerFile.insights_total)} />
              <Detail label="Durée" value={formatDuration(drawerFile.processing_time_seconds)} />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Coût LLM</span>
                <CostDisplay usd={drawerFile.llm_cost_usd} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
                <JobStatusBadge status={fileStatusToJobStatus(drawerFile.status)} />
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
