import { cn, healthColor } from "@/lib/utils"

interface HealthScoreBadgeProps {
  score: number
  large?: boolean
}

export function HealthScoreBadge({ score, large = false }: HealthScoreBadgeProps) {
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
