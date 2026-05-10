import { cn, healthColor } from "@/lib/utils"

interface HealthScoreBadgeProps {
  score: number | null
  large?: boolean
}

export function HealthScoreBadge({ score, large = false }: HealthScoreBadgeProps) {
  if (score == null) return <span className={cn("text-slate-600 font-bold", large ? "text-5xl" : "text-sm")}>—</span>
  return (
    <span
      className={cn(
        "font-bold tabular-nums",
        healthColor(score),
        large ? "text-5xl" : "text-sm",
      )}
    >
      {score}
      <span className={cn("text-slate-500", large ? "text-2xl" : "text-xs")}>
        /100
      </span>
    </span>
  )
}
