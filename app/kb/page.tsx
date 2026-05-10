"use client"

import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { KBStatsCard } from "@/components/kb/KBStatsCard"
import { CaptureForm } from "@/components/kb/CaptureForm"
import { getKBStats } from "@/lib/api"

export default function KBPage() {
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

      <CaptureForm />
    </div>
  )
}
