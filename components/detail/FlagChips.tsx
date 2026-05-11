"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { BookPlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { captureCode } from "@/lib/api"
import type { FileSummary, CaptureRequest } from "@/lib/types"

const FLAG_LABELS: Record<string, string> = {
  missing_branch:            "Branche manquante",
  external_state_dependency: "Dépendance état externe",
  hardcoded_situation_code:  "Code situation hardcodé",
  unmapped_op:               "Opération non mappée",
  api_overload:              "Surcharge API",
  logic_gap:                 "Gap logique",
  missing_null_check:        "Null check manquant",
  direct_db_access:          "Accès DB direct",
}

function flagLabel(type: string): string {
  return FLAG_LABELS[type] ?? type.replace(/_/g, " ")
}

interface FlagChipsProps {
  files: FileSummary[]
}

export function FlagChips({ files }: FlagChipsProps) {
  const [selected, setSelected] = useState<{ type: string; count: number } | null>(null)

  const aggregated: Record<string, number> = {}
  for (const f of files) {
    for (const [type, count] of Object.entries(f.flag_types ?? {})) {
      aggregated[type] = (aggregated[type] ?? 0) + count
    }
  }

  const entries = Object.entries(aggregated).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-slate-500 uppercase tracking-wide">Flags détectés</span>
        <div className="flex flex-wrap gap-1.5">
          {entries.map(([type, count]) => (
            <button
              key={type}
              onClick={() => setSelected({ type, count })}
              title="Capturer dans le KB"
              className="group inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 hover:border-blue-600 hover:bg-slate-700 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <span className="tabular-nums text-blue-400 font-mono font-semibold">{count}×</span>
              <span>{flagLabel(type)}</span>
              <BookPlus className="h-3 w-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <FlagCaptureDialog
          flagType={selected.type}
          count={selected.count}
          context={files.map(f => f.filename).join(", ")}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

interface FlagCaptureDialogProps {
  flagType: string
  count: number
  context: string
  onClose: () => void
}

const DOMAINS = ["commun", "ticketing", "sla", "orchestra", "aircom", "automatisation", "enrichissement-alarmes"]

function FlagCaptureDialog({ flagType, count, context, onClose }: FlagCaptureDialogProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Omit<CaptureRequest, "source">>({
    code: "",
    label: "",
    confiance: "medium",
    domain: "commun",
    notes: `Détecté via flag ${flagType} ×${count} dans ${context}`,
  })

  const mutation = useMutation({
    mutationFn: () =>
      captureCode({
        ...form,
        source: `Flag ${flagType} — Rosetta Cockpit`,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] })
      toast.success(`KB — ${data.code} capturé`, { description: `${data.action} · ${data.confiance}` })
      onClose()
    },
    onError: (err) => {
      toast.error("Échec de la capture", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      })
    },
  })

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <BookPlus className="h-4 w-4 text-blue-400" />
            Capturer dans le KB
          </DialogTitle>
          <DialogDescription className="sr-only">Formulaire de capture d'un token dans le KB Rosetta</DialogDescription>
          <p className="text-xs text-slate-500 mt-1">
            Flag <span className="font-mono text-blue-400">{flagType}</span> · {count}× dans {context}
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
          className="flex flex-col gap-4 mt-1"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-400">Token / Code *</Label>
              <Input
                required
                placeholder="ex: TRONCABLE"
                value={form.code}
                onChange={set("code")}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500 font-mono text-xs uppercase"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-slate-400">Domaine</Label>
              <select
                value={form.domain}
                onChange={set("domain")}
                className="h-9 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-slate-400">Label</Label>
            <Input
              placeholder="Description métier du token"
              value={form.label}
              onChange={set("label")}
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-slate-400">Notes</Label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={set("notes")}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs text-slate-400 shrink-0">Confiance</Label>
            <select
              value={form.confiance}
              onChange={set("confiance")}
              className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="medium">medium</option>
              <option value="inferred">inferred</option>
            </select>
            <span className="text-xs text-slate-600">high = validation PO uniquement</span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-700 text-slate-400 hover:bg-slate-800"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!form.code.trim() || mutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
            >
              {mutation.isPending ? "Envoi…" : "Capturer →  KB"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
