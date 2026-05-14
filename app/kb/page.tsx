"use client"

import { Suspense, useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { KBStatsCard } from "@/components/kb/KBStatsCard"
import { KBEntriesTable } from "@/components/kb/KBEntriesTable"
import { CaptureForm } from "@/components/kb/CaptureForm"
import { getKBStats, getKBEntries } from "@/lib/api"
import type { KBEntry } from "@/lib/types"

// Composant enfant isolé pour contenir useSearchParams (requis par Next.js)
function KBSearchParamsHandler({
  entries,
  onEditEntry,
  onSetDefaultCode,
}: {
  entries: KBEntry[] | undefined
  onEditEntry: (entry: KBEntry) => void
  onSetDefaultCode: (code: string) => void
}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // ?enrich=CODE — navigué depuis la page Pending PO
  useEffect(() => {
    const code = searchParams.get("enrich")
    if (!code || !entries) return
    const found = entries.find(e => e.code === code)
    if (found) {
      onEditEntry(found)
      router.replace("/kb", { scroll: false })
    }
  }, [searchParams, entries, router, onEditEntry])

  // ?code=TOKEN — pré-remplit la capture (depuis LiveMetricsPanel tokens)
  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      onSetDefaultCode(code)
      router.replace("/kb", { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export default function KBPage() {
  const [editEntry, setEditEntry] = useState<KBEntry | null>(null)
  const [defaultCode, setDefaultCode] = useState<string | undefined>(undefined)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kb-stats"],
    queryFn: getKBStats,
  })

  const { data: entries } = useQuery({
    queryKey: ["kb-entries"],
    queryFn: getKBEntries,
    staleTime: 30_000,
  })

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-slate-100">Knowledge Base</h1>

      <Suspense fallback={null}>
        <KBSearchParamsHandler
          entries={entries}
          onEditEntry={setEditEntry}
          onSetDefaultCode={setDefaultCode}
        />
      </Suspense>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full bg-slate-800 rounded-md" />
          <Skeleton className="h-48 w-full bg-slate-800 rounded-md" />
        </div>
      )}

      {isError && (
        <Alert variant="destructive" className="border-red-800 bg-red-950">
          <AlertDescription className="flex items-center justify-between">
            <span>
              {error instanceof Error ? error.message : "Erreur lors du chargement des stats KB"}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}
              className="ml-4 border-red-700 text-red-300 hover:bg-red-900">
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && !data && (
        <p className="text-slate-400 text-sm">Knowledge Base vide. Capturez vos premiers codes métier.</p>
      )}

      {data && <KBStatsCard stats={data} />}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Entrées KB</h2>
        <KBEntriesTable onEdit={setEditEntry} />
      </div>

      <CaptureForm
        editEntry={editEntry}
        onClearEdit={() => setEditEntry(null)}
        defaultCode={defaultCode}
      />
    </div>
  )
}
