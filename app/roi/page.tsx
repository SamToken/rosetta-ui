"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getROI } from "@/lib/api"
import { formatDuration } from "@/lib/utils"
import type { ROISummary } from "@/lib/types"

const LS_KEY_LPH = "rosetta-roi-lines-per-hour"
const LS_KEY_RATE = "rosetta-roi-hourly-rate"

function readLs(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback
  const v = localStorage.getItem(key)
  return v ? Number(v) : fallback
}

export default function ROIPage() {
  const [linesPerHour, setLinesPerHour] = useState<number>(() => readLs(LS_KEY_LPH, 1000))
  const [hourlyRate, setHourlyRate] = useState<number>(() => readLs(LS_KEY_RATE, 75))

  // Valeurs "appliquées" — séparées pour éviter un refetch à chaque frappe
  const [appliedLph, setAppliedLph] = useState(linesPerHour)
  const [appliedRate, setAppliedRate] = useState(hourlyRate)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["roi", appliedLph, appliedRate],
    queryFn: () => getROI(appliedLph, appliedRate),
  })

  function applyParams() {
    const lph = Math.max(100, Math.min(10000, linesPerHour))
    const rate = Math.max(10, Math.min(500, hourlyRate))
    setAppliedLph(lph)
    setAppliedRate(rate)
    setLinesPerHour(lph)
    setHourlyRate(rate)
    localStorage.setItem(LS_KEY_LPH, String(lph))
    localStorage.setItem(LS_KEY_RATE, String(rate))
  }

  const isDirty = linesPerHour !== appliedLph || hourlyRate !== appliedRate

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-100">Dashboard ROI</h1>

        {/* Paramètres de calcul */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span className="text-xs text-slate-500 whitespace-nowrap">Hypothèses :</span>
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 whitespace-nowrap">lignes/h</span>
            <input
              type="number"
              min={100}
              max={10000}
              step={50}
              value={linesPerHour}
              onChange={(e) => setLinesPerHour(Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && applyParams()}
              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 tabular-nums focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 whitespace-nowrap">€/h</span>
            <input
              type="number"
              min={10}
              max={500}
              step={5}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && applyParams()}
              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 tabular-nums focus:outline-none focus:border-blue-500"
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={applyParams}
            disabled={!isDirty}
            className="h-7 px-3 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
          >
            Recalculer
          </Button>
        </div>
      </div>

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
          label="Temps humain économisé"
          value={`${s.total_human_hours_saved.toFixed(1)} h`}
          sub={`@ ${s.lines_per_hour_constant.toLocaleString()} lignes/h`}
          highlight
        />
        <KPICard
          label="Économie estimée"
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
          label="Coût pipeline Rosetta"
          value={`$${s.total_llm_cost_usd.toFixed(4)}`}
          valueClass="text-slate-100"
          badge="API"
          badgeClass="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
          sub="hors sessions Claude Code"
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
        Modifie les hypothèses en haut à droite pour simuler différents scénarios.
        Le coût pipeline ne couvre que les appels LLM émis par Rosetta — les sessions Claude Code sont facturées séparément.
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
  badge,
  badgeClass,
  sub,
}: {
  label: string
  value: string
  valueClass?: string
  badge?: string
  badgeClass?: string
  sub?: string
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-xs text-slate-500 uppercase tracking-wide font-normal">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</span>
          {badge && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeClass}`}>
              {badge}
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
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
