"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CheckCircle2, MessageSquarePlus } from "lucide-react"
import { PendingQueue, PendingQueueSkeleton } from "@/components/kb/PendingQueue"
import { getKBPending, getKBEntries } from "@/lib/api"
import type { KBEntry } from "@/lib/types"

function extractPendingQuestions(entry: KBEntry): string[] {
  if (!entry.notes) return []
  const matches = entry.notes.match(/[Àà]\s*valider\s*PO\s*:[^\n]*/gi) ?? []
  return matches.map(m => m.replace(/^[Àà]\s*valider\s*PO\s*:\s*/i, "").trim()).filter(Boolean)
}

interface KBPendingSectionProps {
  entries: KBEntry[]
}

function KBPendingSection({ entries }: KBPendingSectionProps) {
  const router = useRouter()
  const withPending = entries.filter(e => e.pending_questions > 0)
  if (withPending.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          Depuis la KB
        </h2>
        <span className="text-xs text-slate-600 tabular-nums">
          {withPending.length} entr{withPending.length > 1 ? "ées" : "ée"} avec questions
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {withPending.map(entry => {
          const questions = extractPendingQuestions(entry)
          return (
            <div
              key={entry.code}
              className="flex items-start justify-between gap-4 rounded-md border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {entry.code}
                  </span>
                  <span className="text-xs text-slate-500 italic">{entry.domaine}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-500/15 text-orange-400 border-orange-500/30 font-medium">
                    {entry.pending_questions} ❓
                  </span>
                </div>
                <p className="text-sm text-slate-400 truncate">{entry.label}</p>
                {questions.length > 0 && (
                  <ul className="flex flex-col gap-0.5 mt-0.5">
                    {questions.map((q, i) => (
                      <li key={i} className="text-xs text-slate-500 flex gap-1.5">
                        <span className="text-orange-500 shrink-0">·</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-slate-700 text-blue-400 hover:bg-slate-800 hover:text-blue-300 gap-1.5"
                onClick={() => router.push(`/kb?enrich=${encodeURIComponent(entry.code)}`)}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Répondre
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PendingPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kb-pending"],
    queryFn: getKBPending,
  })

  const { data: entries } = useQuery({
    queryKey: ["kb-entries"],
    queryFn: getKBEntries,
    staleTime: 30_000,
  })

  const totalCount = (data?.length ?? 0) + (entries?.filter(e => e.pending_questions > 0).length ?? 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">
          File de validation PO
          {totalCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-900 px-2 py-0.5 text-xs text-red-200">
              {totalCount}
            </span>
          )}
        </h1>
      </div>

      {isLoading && <PendingQueueSkeleton />}

      {isError && (
        <Alert variant="destructive" className="border-red-800 bg-red-950">
          <AlertDescription className="flex items-center justify-between">
            <span>
              {error instanceof Error ? error.message : "Erreur lors du chargement"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="ml-4 border-red-700 text-red-300 hover:bg-red-900"
            >
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && data && data.length === 0 && (!entries || entries.every(e => e.pending_questions === 0)) && (
        <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-3" />
          <p className="text-slate-300 font-medium">Toutes les questions ont été validées</p>
          <p className="text-slate-600 text-sm mt-1">La KB est à jour.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Questions en attente
          </h2>
          <PendingQueue items={data} />
        </div>
      )}

      {entries && <KBPendingSection entries={entries} />}
    </div>
  )
}
