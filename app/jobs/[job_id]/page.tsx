"use client"

import { use, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { MetricsPanel } from "@/components/detail/MetricsPanel"
import { LiveTerminal } from "@/components/detail/LiveTerminal"
import { HeatmapGrid } from "@/components/detail/HeatmapGrid"
import { RelancerButton } from "@/components/detail/RelancerButton"
import { OutputsTab } from "@/components/detail/OutputsTab"
import { getJob } from "@/lib/api"
import { formatDate, truncate } from "@/lib/utils"
import { ArrowLeft, Network } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ job_id: string }>
}

export default function JobDetailPage({ params }: PageProps) {
  const { job_id } = use(params)

  const [activeTab, setActiveTab] = useState("terminal")

  const { data: job, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["job", job_id],
    queryFn: () => getJob(job_id),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === "running" || s === "queued" ? 2000 : false
    },
  })

  if (isLoading) return <DetailSkeleton />

  if (isError) {
    return (
      <Alert variant="destructive" className="border-red-800 bg-red-950">
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof Error ? error.message : "Job introuvable"}</span>
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
    )
  }

  if (!job) return null

  const showHeatmap = job.result != null && job.result.files.length > 1
  const showOutputs = job.status === "success" && job.result != null
  const isOutputs = activeTab === "outputs"

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Jobs
          </Link>
          <span className="text-slate-700">/</span>
          <span className="font-mono text-xs text-slate-400">{truncate(job_id, 20)}</span>
          <JobStatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-2">
          {job.status === "success" && job.result && (
            <Link
              href={`/jobs/${job_id}/graph`}
              className="flex items-center gap-1.5 text-xs text-slate-400 border border-slate-700 rounded px-2.5 py-1.5 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <Network className="h-3.5 w-3.5" />
              Graphe
            </Link>
          )}
          {job.status === "success" && job.result && (
            <RelancerButton result={job.result} />
          )}
        </div>
      </div>

      {/* Méta */}
      <div className="text-xs text-slate-500 flex gap-4">
        <span>Créé : {formatDate(job.created_at)}</span>
        {job.started_at && <span>Démarré : {formatDate(job.started_at)}</span>}
        {job.finished_at && <span>Terminé : {formatDate(job.finished_at)}</span>}
      </div>

      {/* Erreur job */}
      {job.error && (
        <Alert variant="destructive" className="border-red-800 bg-red-950">
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}

      {/* Layout adaptatif — 4 colonnes en mode Outputs pour plus d'espace */}
      <div className={`grid grid-cols-1 gap-6 ${isOutputs ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {/* Panneau gauche — métriques */}
        <div className="md:col-span-1">
          {job.result ? (
            <MetricsPanel result={job.result} />
          ) : (
            <MetricsPanelSkeleton />
          )}
        </div>

        {/* Panneau droit — terminal + heatmap + outputs */}
        <div className={isOutputs ? "md:col-span-3" : "md:col-span-2"}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger
                value="terminal"
                className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
              >
                Terminal
              </TabsTrigger>
              {showHeatmap && (
                <TabsTrigger
                  value="heatmap"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
                >
                  Heatmap ({job.result!.files.length} fichiers)
                </TabsTrigger>
              )}
              {showOutputs && (
                <TabsTrigger
                  value="outputs"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
                >
                  Outputs
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="terminal" className="mt-3">
              <LiveTerminal
                jobId={job_id}
                initialLogs={job.logs}
                initialStatus={job.status}
              />
            </TabsContent>

            {showHeatmap && (
              <TabsContent value="heatmap" className="mt-3">
                <HeatmapGrid files={job.result!.files} />
              </TabsContent>
            )}

            {showOutputs && (
              <TabsContent value="outputs" className="mt-3">
                <OutputsTab jobId={job_id} result={job.result!} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-48 bg-slate-800" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full bg-slate-800" />
          ))}
        </div>
        <div className="md:col-span-2">
          <Skeleton className="h-[400px] w-full bg-slate-800 rounded-md" />
        </div>
      </div>
    </div>
  )
}

function MetricsPanelSkeleton() {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-8 w-full bg-slate-800" />
      ))}
    </div>
  )
}
