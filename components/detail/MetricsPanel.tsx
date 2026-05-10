import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthScoreBadge } from "@/components/shared/HealthScoreBadge"
import { CostDisplay } from "@/components/shared/CostDisplay"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatDuration, truncate } from "@/lib/utils"
import { FlagChips } from "@/components/detail/FlagChips"
import type { AuditJobResult } from "@/lib/types"

interface MetricsPanelProps {
  result: AuditJobResult
}

function MetricRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <div className="text-sm text-slate-200">{children}</div>
    </div>
  )
}

export function MetricsPanel({ result }: MetricsPanelProps) {
  const truncatedDir = truncate(result.output_dir, 40)

  return (
    <Card className="bg-slate-900 border-slate-800 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-300">Métriques</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Health Score — visuellement proéminent */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide">
            Health Score
          </span>
          <HealthScoreBadge score={result.health_score} large />
        </div>

        <MetricRow label="Fichiers analysés">
          <span className="font-semibold">{result.total_files}</span>
        </MetricRow>

        <MetricRow label="Insights extraits">
          <span className="font-semibold">{result.total_insights}</span>
        </MetricRow>

        <MetricRow label="Coût LLM">
          <CostDisplay usd={result.total_cost_usd} className="font-semibold" />
        </MetricRow>

        <MetricRow label="Durée">
          <span className="font-semibold">
            {formatDuration(result.processing_time_seconds)}
          </span>
        </MetricRow>

        <MetricRow label="Répertoire output">
          <Tooltip>
            <TooltipTrigger className="font-mono text-xs text-slate-400 break-all cursor-default text-left">
              {truncatedDir}
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="max-w-xs break-all bg-slate-800 text-slate-200 border-slate-700"
            >
              {result.output_dir}
            </TooltipContent>
          </Tooltip>
        </MetricRow>

        <FlagChips files={result.files} />
      </CardContent>
    </Card>
  )
}
