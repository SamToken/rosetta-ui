"use client"

import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { PendingQueue, PendingQueueSkeleton } from "@/components/kb/PendingQueue"
import { getKBPending } from "@/lib/api"

export default function PendingPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["kb-pending"],
    queryFn: getKBPending,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">
          File de validation PO
          {data && data.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-900 px-2 py-0.5 text-xs text-red-200">
              {data.length}
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

      {!isLoading && !isError && data && data.length === 0 && (
        <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-3" />
          <p className="text-slate-300 font-medium">Toutes les questions ont été validées</p>
          <p className="text-slate-600 text-sm mt-1">La KB est à jour.</p>
        </div>
      )}

      {data && data.length > 0 && <PendingQueue items={data} />}
    </div>
  )
}
