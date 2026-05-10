"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { JobsTable } from "@/components/jobs/JobsTable"
import { getJobs } from "@/lib/api"
import { hasActiveJobs } from "@/lib/utils"
import { JobLauncher } from "@/components/shared/JobLauncher"
import { RefreshCw } from "lucide-react"

export default function JobsPage() {
  const router = useRouter()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs,
    refetchInterval: (query) => {
      const jobs = query.state.data
      return jobs && hasActiveJobs(jobs) ? 3000 : false
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Jobs d&apos;audit</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Actualiser
          </Button>
          <JobLauncher />
        </div>
      </div>

      {isLoading && <JobsTableSkeleton />}

      {isError && (
        <Alert variant="destructive" className="border-red-800 bg-red-950">
          <AlertDescription className="flex items-center justify-between">
            <span>
              {error instanceof Error ? error.message : "Erreur lors du chargement des jobs"}
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
          <p className="text-slate-400 text-sm">Aucun audit lancé.</p>
          <p className="text-slate-600 text-xs mt-1">
            Cliquez sur <span className="text-blue-400">Nouvel audit</span> pour démarrer.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <JobsTable
          jobs={data}
          onRowClick={(job) => router.push(`/jobs/${job.job_id}`)}
        />
      )}
    </div>
  )
}

function JobsTableSkeleton() {
  return (
    <div className="rounded-md border border-slate-800 overflow-hidden">
      <div className="p-4 flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24 bg-slate-800" />
            <Skeleton className="h-4 w-20 bg-slate-800" />
            <Skeleton className="h-4 w-32 bg-slate-800" />
            <Skeleton className="h-4 w-8 bg-slate-800 ml-auto" />
            <Skeleton className="h-4 w-16 bg-slate-800" />
            <Skeleton className="h-4 w-12 bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
