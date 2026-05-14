"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { captureCode, getKBDomains } from "@/lib/api"
import { cn } from "@/lib/utils"

const BASE_DOMAINS = [
  "commun", "ticketing", "sla", "diagnostic", "interco",
  "aircom", "airele", "orchestra", "scenario", "enrichissement-alarmes",
  "oceane", "referentiel", "supervision", "automatisation", "variables",
]

interface EnrichToken {
  code: string
  count: number
}

type RowStatus = "idle" | "pending" | "success" | "error"

interface TokenRow extends EnrichToken {
  label: string
  domain: string
  notes: string
  status: RowStatus
  error?: string
}

interface BatchCaptureModalProps {
  tokens: EnrichToken[]
  context: string
  onClose: () => void
}

export function BatchCaptureModal({ tokens, context, onClose }: BatchCaptureModalProps) {
  const queryClient = useQueryClient()

  const [rows, setRows] = useState<TokenRow[]>(() =>
    tokens.map(t => ({
      ...t,
      label: "",
      domain: "commun",
      notes: `Détecté ×${t.count} dans ${context}`,
      status: "idle",
    }))
  )
  const [submitting, setSubmitting] = useState(false)

  const { data: domains } = useQuery({
    queryKey: ["kb-domains"],
    queryFn: getKBDomains,
    staleTime: 60_000,
  })

  function patch(idx: number, update: Partial<TokenRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...update } : r))
  }

  const readyRows  = rows.filter(r => r.label.trim() && r.status === "idle")
  const doneCount  = rows.filter(r => r.status === "success").length
  const allDone    = doneCount === rows.length

  async function handleCapture() {
    if (readyRows.length === 0) return
    setSubmitting(true)

    await Promise.allSettled(
      rows.map(async (row, idx) => {
        if (!row.label.trim() || row.status !== "idle") return
        patch(idx, { status: "pending" })
        try {
          await captureCode({
            code: row.code,
            label: row.label.trim(),
            domain: row.domain,
            notes: row.notes.trim() || undefined,
            source: `Rosetta Cockpit — lot ${new Date().toISOString().slice(0, 10)}`,
            confiance: "medium",
          })
          patch(idx, { status: "success" })
        } catch (e) {
          patch(idx, {
            status: "error",
            error: e instanceof Error ? e.message : "Erreur API",
          })
        }
      })
    )

    queryClient.invalidateQueries({ queryKey: ["kb-stats"] })
    queryClient.invalidateQueries({ queryKey: ["kb-entries"] })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 gap-4">
          <div>
            <p className="text-slate-100 font-semibold">Capture KB en lot</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {rows.length} token{rows.length > 1 ? "s" : ""} non documentés ·
              remplis le label pour chacun · confiance <span className="text-orange-400">medium</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[28px_140px_1fr_120px] gap-x-3 px-5 py-2 border-b border-slate-800/60 text-[10px] uppercase tracking-wide text-slate-600">
          <div />
          <div>Token</div>
          <div>Label métier *</div>
          <div>Domaine</div>
        </div>

        {/* Datalist domaines (partagé par toutes les lignes) */}
        <datalist id="batch-domains-list">
          {[...new Set([...BASE_DOMAINS, ...(domains ?? [])])].sort().map(d => (
            <option key={d} value={d} />
          ))}
        </datalist>

        {/* Rows */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-800/40">
          {rows.map((row, idx) => (
            <div
              key={row.code}
              className={cn(
                "grid grid-cols-[28px_140px_1fr_120px] gap-x-3 items-center px-5 py-2.5",
                row.status === "success" && "opacity-50"
              )}
            >
              {/* Status */}
              <div className="flex items-center justify-center">
                {row.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                {row.status === "error"   && <AlertCircle  className="h-4 w-4 text-red-400" aria-label={row.error} />}
                {row.status === "pending" && <Loader2 className="h-4 w-4 text-orange-400 animate-spin" />}
                {row.status === "idle"    && (
                  <span className="h-4 w-4 rounded-full border border-slate-700 text-[9px] text-slate-600 flex items-center justify-center">
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Code + count */}
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-blue-300 truncate">{row.code}</p>
                <p className="text-[10px] text-slate-600">{row.count}× détecté</p>
              </div>

              {/* Label */}
              <input
                disabled={row.status !== "idle"}
                placeholder="Label métier…"
                value={row.label}
                onChange={e => patch(idx, { label: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              />

              {/* Domain */}
              <input
                list="batch-domains-list"
                disabled={row.status !== "idle"}
                value={row.domain}
                onChange={e => patch(idx, { domain: e.target.value })}
                placeholder="domaine…"
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 gap-4">
          <p className="text-xs text-slate-500">
            {allDone
              ? `✓ ${doneCount} token${doneCount > 1 ? "s" : ""} capturé${doneCount > 1 ? "s" : ""} · prochain scan = moins cher`
              : readyRows.length > 0
              ? `${readyRows.length}/${rows.length} prêt${readyRows.length > 1 ? "s" : ""}`
              : "Remplis les labels pour activer la capture"
            }
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-700 text-slate-400 hover:bg-slate-800"
            >
              {allDone ? "Fermer" : "Annuler"}
            </Button>
            {!allDone && (
              <Button
                size="sm"
                disabled={readyRows.length === 0 || submitting}
                onClick={handleCapture}
                className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 min-w-[120px]"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Capture…
                  </span>
                ) : (
                  `Capturer ${readyRows.length > 0 ? readyRows.length : ""} token${readyRows.length !== 1 ? "s" : ""}`
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
