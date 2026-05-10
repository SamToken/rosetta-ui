"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { validatePending } from "@/lib/api"
import type { PendingItem, Priority } from "@/lib/types"

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  high: { label: "CRITIQUE", className: "bg-red-900 text-red-200 border-red-700 border" },
  medium: { label: "MOYEN", className: "bg-orange-900 text-orange-200 border-orange-700 border" },
  low: { label: "BAS", className: "bg-slate-800 text-slate-300 border-slate-700 border" },
}

interface PendingQueueProps {
  items: PendingItem[]
}

export function PendingQueue({ items }: PendingQueueProps) {
  const [selected, setSelected] = useState<PendingItem | null>(null)
  const [label, setLabel] = useState("")
  const [notes, setNotes] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      validatePending(id, {
        label: label.trim() || undefined,
        notes: notes.trim() || undefined,
        source: `PO validé — ${new Date().toISOString().slice(0, 10)}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-pending"] })
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] })
      setSelected(null)
      setLabel("")
      setNotes("")
    },
  })

  const sorted = [...items].sort((a, b) => {
    const order: Priority[] = ["high", "medium", "low"]
    return order.indexOf(a.priorite) - order.indexOf(b.priorite)
  })

  return (
    <>
      <div className="flex flex-col gap-2">
        {sorted.map((item) => {
          const { label: pLabel, className } = PRIORITY_CONFIG[item.priorite]
          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-md border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={className}>{pLabel}</Badge>
                  <span className="font-mono text-xs text-slate-400">{item.id}</span>
                  {item.domaine && (
                    <span className="text-xs text-slate-500 italic">{item.domaine}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-200 break-words">{item.code}</p>
                <p className="text-sm text-slate-400">{item.question}</p>
                {item.fichiers.length > 0 && (
                  <p className="text-xs text-slate-600">
                    {item.fichiers.slice(0, 3).join(" · ")}
                    {item.fichiers.length > 3 && ` +${item.fichiers.length - 3}`}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setSelected(item)}
              >
                Valider
              </Button>
            </div>
          )
        })}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setLabel("")
            setNotes("")
            mutation.reset()
          }
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Valider — {selected?.code}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-400">{selected.question}</p>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 uppercase tracking-wide">
                  Label métier (requis)
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                  rows={2}
                  placeholder="Ex : Délai SLA priorité 2 en heures ouvrées"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 uppercase tracking-wide">
                  Notes (optionnel)
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                  rows={3}
                  placeholder="Contexte, couplages, remarques PO…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {mutation.isError && (
                <Alert variant="destructive" className="border-red-800 bg-red-950">
                  <AlertDescription>
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : "Erreur lors de la validation"}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => setSelected(null)}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button
              className="bg-blue-700 hover:bg-blue-600 text-white"
              disabled={!label.trim() || mutation.isPending}
              onClick={() => selected && mutation.mutate({ id: selected.id })}
            >
              {mutation.isPending ? "Validation…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PendingQueueSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border border-slate-800 p-4">
          <Skeleton className="h-4 w-24 bg-slate-800 mb-2" />
          <Skeleton className="h-3 w-full bg-slate-800 mb-1" />
          <Skeleton className="h-3 w-2/3 bg-slate-800" />
        </div>
      ))}
    </div>
  )
}
