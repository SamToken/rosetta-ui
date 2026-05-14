"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, AlertTriangle, Zap, BookmarkPlus, X } from "lucide-react"
import { getJobFlags, captureCode, getKBDomains } from "@/lib/api"
import type { CaptureRequest, FlagOut, RecipeOut } from "@/lib/types"
import { cn } from "@/lib/utils"

// ── Effort badge ──────────────────────────────────────────────────────────

const EFFORT_STYLES: Record<string, string> = {
  low:    "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high:   "bg-red-500/15 text-red-400 border-red-500/30",
}

function EffortBadge({ effort }: { effort: string }) {
  return (
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide",
      EFFORT_STYLES[effort.toLowerCase()] ?? "bg-slate-700/40 text-slate-400 border-slate-600/30",
    )}>
      {effort}
    </span>
  )
}

// ── Type badge ────────────────────────────────────────────────────────────

const FLAG_TYPE_LABELS: Record<string, string> = {
  magic_value:      "Magic value",
  missing_branch:   "Branch manquante",
  dead_code:        "Code mort",
  hardcoded_sql:    "SQL en dur",
  zend_pattern:     "Pattern Zend",
  legacy_service:   "Service legacy",
  missing_doc:      "Doc absente",
  complex_method:   "Méthode complexe",
  global_state:     "État global",
}

function FlagTypeBadge({ type }: { type: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-700 font-mono">
      {FLAG_TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ── Diff block ────────────────────────────────────────────────────────────

function DiffBlock({ before, after }: { before: string; after: string }) {
  if (!before && !after) return null
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {before && (
        <div>
          <p className="text-[10px] text-red-400 font-medium mb-1">— Avant (Zend)</p>
          <pre className="text-[10px] font-mono bg-red-950/30 border border-red-900/30 rounded p-2 overflow-x-auto text-red-300 whitespace-pre-wrap break-all">{before}</pre>
        </div>
      )}
      {after && (
        <div>
          <p className="text-[10px] text-green-400 font-medium mb-1">+ Après (Symfony)</p>
          <pre className="text-[10px] font-mono bg-green-950/30 border border-green-900/30 rounded p-2 overflow-x-auto text-green-300 whitespace-pre-wrap break-all">{after}</pre>
        </div>
      )}
    </div>
  )
}

// ── Recipe block ──────────────────────────────────────────────────────────

function RecipeBlock({ recipe }: { recipe: RecipeOut }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border border-blue-500/20 rounded-md bg-blue-500/5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        <span className="flex-1 text-xs font-medium text-blue-300">{recipe.title}</span>
        <EffortBadge effort={recipe.effort} />
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <p className="text-slate-500 mb-0.5">Pattern Zend</p>
              <code className="font-mono text-slate-300">{recipe.zend_pattern}</code>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Équivalent Symfony</p>
              <code className="font-mono text-slate-300">{recipe.symfony_equivalent}</code>
            </div>
          </div>
          <DiffBlock before={recipe.diff_before} after={recipe.diff_after} />
          {recipe.migration_notes && (
            <p className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 mt-1">
              {recipe.migration_notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Flag capture modal ────────────────────────────────────────────────────

const BASE_DOMAINS = [
  "commun", "ticketing", "sla", "diagnostic", "interco",
  "aircom", "airele", "orchestra", "scenario", "enrichissement-alarmes",
  "oceane", "referentiel", "supervision", "automatisation", "variables",
]

const INPUT_CLASS =
  "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"

function flagToForm(flag: FlagOut): CaptureRequest {
  const noteParts = [
    `[${FLAG_TYPE_LABELS[flag.type] ?? flag.type}]`,
    flag.location
      ? `${flag.location}${flag.source_line != null ? `:${flag.source_line}` : ""}`
      : null,
    flag.question || null,
  ].filter(Boolean)

  return {
    code: flag.fragment || "",
    label: "",
    source: "",
    confiance: "medium",
    domain: "commun",
    notes: noteParts.join("\n"),
  }
}

function FlagCaptureModal({ flag, onClose }: { flag: FlagOut; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CaptureRequest>(() => flagToForm(flag))
  const [done, setDone] = useState(false)

  const { data: domains } = useQuery({
    queryKey: ["kb-domains"],
    queryFn: getKBDomains,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: captureCode,
    onSuccess: () => {
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] })
      queryClient.invalidateQueries({ queryKey: ["kb-entries"] })
      setTimeout(onClose, 1000)
    },
  })

  function field(key: keyof CaptureRequest) {
    return {
      value: String(form[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">Capturer → KB</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
              {FLAG_TYPE_LABELS[flag.type] ?? flag.type}
              {flag.location ? ` · ${flag.location}` : ""}
              {flag.source_line != null ? `:${flag.source_line}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="ml-3 text-slate-500 hover:text-slate-300 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }}
          className="p-5 flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wide">Code *</label>
              <input required className={INPUT_CLASS} placeholder="EX: TP2" {...field("code")} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wide">Domaine *</label>
              <select required className={INPUT_CLASS} {...field("domain")}>
                {[...new Set([...BASE_DOMAINS, ...(domains ?? [])])].sort().map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 uppercase tracking-wide">Label *</label>
            <input required placeholder="Description métier claire" className={INPUT_CLASS} {...field("label")} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 uppercase tracking-wide">Source *</label>
            <input required placeholder="PO validé — 2026-05-14" className={INPUT_CLASS} {...field("source")} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 uppercase tracking-wide">Confiance</label>
            <select className={INPUT_CLASS} {...field("confiance")}>
              <option value="medium">medium</option>
              <option value="inferred">inferred</option>
              <option value="high">high (PO uniquement)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 uppercase tracking-wide">Notes</label>
            <textarea rows={3} className={INPUT_CLASS} {...field("notes")} />
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-400">
              {mutation.error instanceof Error ? mutation.error.message : "Erreur API"}
            </p>
          )}
          {done && <p className="text-xs text-green-400">✓ Capturé en KB</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={mutation.isPending || done}
              className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-md transition-colors"
            >
              {mutation.isPending ? "Capture…" : "Capturer"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 text-sm text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Flag row ──────────────────────────────────────────────────────────────

function FlagRow({ flag, onCapture }: { flag: FlagOut; onCapture: (f: FlagOut) => void }) {
  const [open, setOpen] = useState(false)
  const hasDetails = flag.question || flag.recipe || flag.fragment

  return (
    <div className={cn(
      "border rounded-lg transition-colors",
      open ? "border-slate-700 bg-slate-800/30" : "border-slate-800 hover:border-slate-700",
    )}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button
          className="flex-1 flex items-start gap-3 text-left min-w-0"
          onClick={() => hasDetails && setOpen(v => !v)}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <FlagTypeBadge type={flag.type} />
              {flag.recipe && <span className="text-[10px] text-blue-400 font-medium">🔧 recette</span>}
              {flag.location && (
                <span className="text-[10px] font-mono text-slate-500 truncate">{flag.location}</span>
              )}
              {flag.source_line != null && (
                <span className="text-[10px] text-slate-600">:{flag.source_line}</span>
              )}
            </div>
            {flag.fragment && (
              <code className="mt-1 block text-[10px] font-mono text-slate-400 truncate">{flag.fragment}</code>
            )}
          </div>
          {hasDetails && (
            open
              ? <ChevronDown className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
          )}
        </button>

        {/* Capture button — outside the expand button */}
        <button
          type="button"
          title="Capturer → KB"
          onClick={(e) => { e.stopPropagation(); onCapture(flag) }}
          className="shrink-0 mt-0.5 text-slate-600 hover:text-blue-400 transition-colors"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-slate-800">
          {flag.question && (
            <p className="text-xs text-slate-300 pt-2">{flag.question}</p>
          )}
          {flag.recipe && <RecipeBlock recipe={flag.recipe} />}
        </div>
      )}
    </div>
  )
}

// ── Group by method ───────────────────────────────────────────────────────

function MethodGroup({ method, flags, onCapture }: {
  method: string
  flags: FlagOut[]
  onCapture: (f: FlagOut) => void
}) {
  const [open, setOpen] = useState(true)
  const withRecipe = flags.filter(f => f.recipe).length

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
        <span className="font-mono text-sm text-slate-200 flex-1">{method}</span>
        <span className="text-xs text-slate-500 tabular-nums">{flags.length} flag{flags.length > 1 ? "s" : ""}</span>
        {withRecipe > 0 && (
          <span className="text-[10px] text-blue-400 font-medium">{withRecipe} recette{withRecipe > 1 ? "s" : ""}</span>
        )}
      </button>
      {open && (
        <div className="p-2 flex flex-col gap-1.5">
          {flags.map((flag, i) => (
            <FlagRow
              key={`${flag.id || flag.fragment}-${i}`}
              flag={flag}
              onCapture={onCapture}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function FlagsTab({ jobId }: { jobId: string }) {
  const [captureFlag, setCaptureFlag] = useState<FlagOut | null>(null)

  const { data: flags, isLoading } = useQuery({
    queryKey: ["job-flags", jobId],
    queryFn: () => getJobFlags(jobId),
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-800/60 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!flags || flags.length === 0) {
    return (
      <div className="text-center py-12 text-slate-600 text-sm">
        Aucun flag détecté pour ce job.
      </div>
    )
  }

  const withRecipe = flags.filter(f => f.recipe).length

  const groups: Record<string, FlagOut[]> = {}
  for (const f of flags) {
    const key = f.method_name || "(global)"
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  }

  return (
    <>
      {captureFlag && (
        <FlagCaptureModal flag={captureFlag} onClose={() => setCaptureFlag(null)} />
      )}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span><span className="text-slate-300 font-medium">{flags.length}</span> flag{flags.length > 1 ? "s" : ""}</span>
          {withRecipe > 0 && (
            <span className="text-blue-400"><span className="font-medium">{withRecipe}</span> avec recette migration</span>
          )}
          <span>{Object.keys(groups).length} méthode{Object.keys(groups).length > 1 ? "s" : ""}</span>
        </div>
        <div className="flex flex-col gap-2">
          {Object.entries(groups).map(([method, mflags]) => (
            <MethodGroup
              key={method}
              method={method}
              flags={mflags}
              onCapture={setCaptureFlag}
            />
          ))}
        </div>
      </div>
    </>
  )
}
