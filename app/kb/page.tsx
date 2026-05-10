"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { KBStatsCard } from "@/components/kb/KBStatsCard"
import { KBEntriesTable } from "@/components/kb/KBEntriesTable"
import { CaptureForm } from "@/components/kb/CaptureForm"
import { getKBStats } from "@/lib/api"
import type { KBEntry } from "@/lib/types"

export default function KBPage() {
  const [editEntry, setEditEntry] = useState<KBEntry | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kb-stats"],
    queryFn: getKBStats,
  })

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-slate-100">Knowledge Base</h1>

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

      {!isLoading && !isError && !data && (
        <p className="text-slate-400 text-sm">Knowledge Base vide. Capturez vos premiers codes métier.</p>
      )}

      {data && <KBStatsCard stats={data} />}

      {/* Entrées KB navigables — clic → pré-remplit CaptureForm */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          Entrées KB
        </h2>
        <KBEntriesTable onEdit={setEditEntry} />
      </div>

      {/* Formulaire — pré-rempli si editEntry, vide sinon */}
      <CaptureForm
        editEntry={editEntry}
        onClearEdit={() => setEditEntry(null)}
      />
    </div>
  )
}
