"use client"

import { use, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge"
import { MetricsPanel } from "@/components/detail/MetricsPanel"
import { LiveTerminal } from "@/components/detail/LiveTerminal"
import { HeatmapGrid } from "@/components/detail/HeatmapGrid"
import { RelancerButton } from "@/components/detail/RelancerButton"
import { LiveMetricsPanel } from "@/components/detail/LiveMetricsPanel"
import { OutputsTab } from "@/components/detail/OutputsTab"
import { BatchCaptureModal } from "@/components/detail/BatchCaptureModal"
import { getJob, exportJobHuman, startAudit } from "@/lib/api"
import { formatDate, truncate, flagsColor } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { ArrowLeft, Network, TerminalSquare, LayoutGrid, FolderOpen, BookOpen, Sparkles, DatabaseZap } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import type { FileSummary } from "@/lib/types"

interface PageProps {
  params: Promise<{ job_id: string }>
}

// ── Coût et durée estimés ──────────────────────────────────────────────────

const COST_PER_FILE_USD  = 0.08
const MIN_PER_FLAG       = 0.10  // calibré : 120 flags ≈ 12 min réel

const RE_TO_ENRICH_JOB = /→\s*À enrichir en KB\s*:\s*(.+)/i
const RE_TOKEN_JOB     = /(\w+)\((\d+)[x×]\)/g

function parseJobEnrichTokens(logs: string[]): Array<{ code: string; count: number }> {
  const tokens: Array<{ code: string; count: number }> = []
  const seen = new Set<string>()
  for (const line of logs) {
    const m = line.match(RE_TO_ENRICH_JOB)
    if (m) {
      for (const tok of m[1].matchAll(RE_TOKEN_JOB)) {
        if (!seen.has(tok[1])) {
          seen.add(tok[1])
          tokens.push({ code: tok[1], count: parseInt(tok[2]) })
        }
      }
    }
  }
  return tokens
}

function riskLabel(flags: number): string {
  if (flags <= 10) return "✅"
  if (flags <= 60) return "🟡"
  return "🔴"
}

// ── Modal confirmation LLM ─────────────────────────────────────────────────

interface LLMModal {
  paths: string[]
  files: FileSummary[]
}

function LLMConfirmModal({
  modal,
  onConfirm,
  onCancel,
  isPending,
}: {
  modal: LLMModal
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const n = modal.paths.length
  const costEst = (n * COST_PER_FILE_USD).toFixed(2)
  const durMin  = (() => {
    const fromFiles = modal.files.reduce(
      (sum, f) => sum + Math.max(1, Math.ceil(f.flags_total * MIN_PER_FLAG)), 0
    )
    const unknown = n - modal.files.length
    return fromFiles + unknown * 2
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 flex flex-col gap-5">
        <div>
          <p className="text-slate-100 font-semibold text-base">Lancer l'analyse LLM</p>
          <p className="text-slate-500 text-sm mt-0.5">{n} fichier{n > 1 ? "s" : ""} sélectionné{n > 1 ? "s" : ""}</p>
        </div>

        {/* Liste fichiers */}
        <div className="rounded-md border border-slate-800 overflow-hidden max-h-52 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <tbody>
              {modal.files.map(f => (
                <tr key={f.filename} className="border-b border-slate-800/60">
                  <td className="px-3 py-2 font-mono text-slate-200 truncate max-w-[200px]">
                    {f.filename.replace(/\.php$/, "")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: flagsColor(f.flags_total) }}>
                    {f.flags_total}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{riskLabel(f.flags_total)}</td>
                </tr>
              ))}
              {/* Fichiers sans FileSummary (chemin connu mais pas dans les files) */}
              {modal.paths.filter(p =>
                !modal.files.some(f => p === f.filename || p.endsWith("/" + f.filename))
              ).map(p => (
                <tr key={p} className="border-b border-slate-800/60">
                  <td className="px-3 py-2 font-mono text-slate-400 truncate max-w-[200px]">
                    {p.split("/").pop()?.replace(/\.php$/, "") ?? p}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Estimations */}
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Coût estimé</p>
            <p className="text-slate-200 font-semibold">~${costEst}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Durée estimée</p>
            <p className="text-slate-200 font-semibold">~{durMin} min</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-1.5 rounded text-sm border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Lancement…</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" />▶ Confirmer</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function JobDetailPage({ params }: PageProps) {
  const { job_id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState("terminal")
  const [exportingKB, setExportingKB] = useState(false)
  const [llmModal, setLlmModal] = useState<LLMModal | null>(null)
  const [batchModal, setBatchModal] = useState(false)

  const { data: job, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["job", job_id],
    queryFn: () => getJob(job_id),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === "running" || s === "queued" ? 2000 : false
    },
  })

  const launchMutation = useMutation({
    mutationFn: (paths: string[]) =>
      startAudit({ php_paths: paths, no_llm: false, max_workers: Math.min(paths.length, 4) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job LLM lancé", { description: `${llmModal?.paths.length} fichier(s) en analyse` })
      setLlmModal(null)
      router.push(`/jobs/${data.job_id}`)
    },
    onError: (err) => {
      toast.error("Échec du lancement", { description: err instanceof Error ? err.message : "Erreur inconnue" })
    },
  })

  function handleLaunchLLM(paths: string[]) {
    const files = (job?.result?.files ?? []).filter(f =>
      paths.some(p => p === f.filename || p.endsWith("/" + f.filename))
    )
    setLlmModal({ paths, files })
  }

  if (isLoading) return <DetailSkeleton />

  if (isError) {
    return (
      <Alert variant="destructive" className="border-red-800 bg-red-950">
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof Error ? error.message : "Job introuvable"}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4 border-red-700 text-red-300 hover:bg-red-900">
            Réessayer
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!job) return null

  const showHeatmap   = job.result != null && job.result.files.length > 1
  const showOutputs   = job.status === "success" && job.result != null
  const isOutputs     = activeTab === "outputs"
  const enrichTokens  = job.status === "success" ? parseJobEnrichTokens(job.logs) : []
  const batchContext  = (job.result?.files ?? []).map(f => f.filename).join(", ")

  // Progression parsée depuis les logs [i/n] non-indenté = niveau fichier
  const progress = (() => {
    if (job.status !== "running" && job.status !== "queued") return null
    let current = 0, total = 0
    for (const line of job.logs) {
      const m = line.match(/^\[(\d+)\/(\d+)\]/)
      if (m) { current = parseInt(m[1]); total = parseInt(m[2]) }
    }
    if (total === 0) return null
    return { current, total }
  })()

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors">
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
          {job.status === "success" && enrichTokens.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchModal(true)}
              className="flex items-center gap-1.5 text-xs border-orange-700/50 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
            >
              <DatabaseZap className="h-3.5 w-3.5" />
              Capturer en lot ({enrichTokens.length})
            </Button>
          )}
          {job.status === "success" && job.result && (
            <Button
              variant="outline"
              size="sm"
              disabled={exportingKB}
              onClick={async () => {
                setExportingKB(true)
                try {
                  await exportJobHuman(job_id)
                  toast.success("Dossier de fusion KB téléchargé")
                } catch {
                  toast.error("Impossible de générer l'export KB")
                } finally {
                  setExportingKB(false)
                }
              }}
              className="flex items-center gap-1.5 text-xs border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {exportingKB ? "Export…" : "KB Fusion"}
            </Button>
          )}
          {job.status === "success" && job.result && (
            <RelancerButton result={job.result} />
          )}
        </div>
      </div>

      {/* Barre de progression */}
      {progress && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Analyse en cours — fichier {progress.current}/{progress.total}</span>
            <span className="tabular-nums">{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-700"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Méta */}
      <div className="text-xs text-slate-500 flex gap-4">
        <span>Créé : {formatDate(job.created_at)}</span>
        {job.started_at  && <span>Démarré : {formatDate(job.started_at)}</span>}
        {job.finished_at && <span>Terminé : {formatDate(job.finished_at)}</span>}
      </div>

      {job.error && (
        <Alert variant="destructive" className="border-red-800 bg-red-950">
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}

      <div className={`grid grid-cols-1 gap-6 ${isOutputs ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <div className="md:col-span-1">
          {job.result ? (
            <MetricsPanel result={job.result} />
          ) : (job.status === "running" || job.status === "queued") ? (
            <LiveMetricsPanel logs={job.logs} startedAt={job.started_at} />
          ) : (
            <MetricsPanelSkeleton />
          )}
        </div>

        <div className={isOutputs ? "md:col-span-3" : "md:col-span-2"}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="bg-transparent border-b border-slate-800 rounded-none h-auto p-0 gap-0">
              <TabsTrigger value="terminal" className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors data-[state=active]:border-orange-500 data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <TerminalSquare className="h-3.5 w-3.5" />
                Terminal
              </TabsTrigger>
              {showHeatmap && (
                <TabsTrigger value="heatmap" className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors data-[state=active]:border-orange-500 data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Carte de risque ({job.result!.files.length} fichiers)
                </TabsTrigger>
              )}
              {showOutputs && (
                <TabsTrigger value="outputs" className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors data-[state=active]:border-orange-500 data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Fichiers de sortie
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="terminal" className="mt-3">
              <LiveTerminal jobId={job_id} initialLogs={job.logs} initialStatus={job.status} />
            </TabsContent>

            {showHeatmap && (
              <TabsContent value="heatmap" className="mt-3">
                <HeatmapGrid
                  files={job.result!.files}
                  phpPaths={job.result!.php_paths ?? []}
                  onLaunchLLM={handleLaunchLLM}
                />
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

      {/* Modal capture KB en lot */}
      {batchModal && enrichTokens.length > 0 && (
        <BatchCaptureModal
          tokens={enrichTokens}
          context={batchContext}
          onClose={() => setBatchModal(false)}
        />
      )}

      {/* Modal confirmation LLM */}
      {llmModal && (
        <LLMConfirmModal
          modal={llmModal}
          onConfirm={() => launchMutation.mutate(llmModal.paths)}
          onCancel={() => { setLlmModal(null); launchMutation.reset() }}
          isPending={launchMutation.isPending}
        />
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-48 bg-slate-800" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full bg-slate-800" />)}
        </div>
        <div className="md:col-span-2">
          <Skeleton className="h-[400px] w-full bg-slate-800 rounded-md" />
        </div>
      </div>
    </div>
  )
}

function MetricsPanelSkeleton() {
  const labels = ["Health Score", "Fichiers analysés", "Insights extraits", "Coût LLM", "Durée"]
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
      {labels.map(label => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-xs text-slate-600 uppercase tracking-wide">{label}</span>
          <Skeleton className="h-5 w-3/4 bg-slate-800" />
        </div>
      ))}
    </div>
  )
}
