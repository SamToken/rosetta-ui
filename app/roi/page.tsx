"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getROI } from "@/lib/api"
import { formatDuration } from "@/lib/utils"
import type { ROISummary } from "@/lib/types"

export default function ROIPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["roi"],
    queryFn: getROI,
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-100">Dashboard ROI</h1>

      {isLoading && <ROISkeleton />}

      {isError && (
        <Alert variant="destructive" className="border-red-800 bg-red-950">
          <AlertDescription className="flex items-center justify-between">
            <span>
              {error instanceof Error ? error.message : "Erreur lors du chargement du ROI"}
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

      {data && <ROIDashboard summary={data} />}
    </div>
  )
}

function ROIDashboard({ summary: s }: { summary: ROISummary }) {
  return (
    <div className="flex flex-col gap-6">
      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Audits effectués"
          value={String(s.total_runs)}
          sub={`${s.success_rate_pct.toFixed(1)} % succès`}
        />
        <KPICard
          label="Lignes analysées"
          value={s.total_lines_analyzed.toLocaleString("fr-FR")}
          sub={`${s.avg_processing_seconds.toFixed(1)}s moy. / fichier`}
        />
        <KPICard
          label="Heures humaines économisées"
          value={`${s.total_human_hours_saved.toFixed(1)} h`}
          sub={`@ ${s.lines_per_hour_constant.toLocaleString()} lignes/h`}
          highlight
        />
        <KPICard
          label="Économie financière"
          value={`${s.financial_saving_eur.toFixed(0)} €`}
          sub={`@ ${s.hourly_rate_eur.toFixed(0)} €/h dev senior`}
          highlight
        />
      </div>

      {/* Métriques secondaires */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Temps machine total"
          value={formatDuration(s.total_machine_seconds)}
        />
        <MetricCard
          label="Coût LLM total"
          value={`$${s.total_llm_cost_usd.toFixed(4)}`}
          valueClass="text-yellow-400"
        />
        <MetricCard
          label="Taux de succès"
          value={`${s.success_rate_pct.toFixed(1)} %`}
          valueClass={s.success_rate_pct >= 90 ? "text-green-400" : "text-orange-400"}
        />
      </div>

      {/* Note de calcul */}
      <p className="text-xs text-slate-600">
        Économie calculée sur la base de {s.lines_per_hour_constant.toLocaleString()} lignes/heure
        en revue manuelle × {s.hourly_rate_eur.toFixed(0)} €/h (développeur senior).
        Données locales — aucune transmission externe.
      </p>
    </div>
  )
}

function KPICard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <Card className={`border-slate-800 ${highlight ? "bg-slate-800" : "bg-slate-900"}`}>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-white" : "text-slate-100"}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  valueClass = "text-slate-200",
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-xs text-slate-500 uppercase tracking-wide font-normal">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <span className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</span>
      </CardContent>
    </Card>
  )
}

function ROISkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full bg-slate-800 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full bg-slate-800 rounded-md" />
        ))}
      </div>
    </div>
  )
}
