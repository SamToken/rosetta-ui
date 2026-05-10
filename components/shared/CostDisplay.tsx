import { formatCost } from "@/lib/utils"

interface CostDisplayProps {
  usd: number
  className?: string
}

export function CostDisplay({ usd, className }: CostDisplayProps) {
  const text = formatCost(usd)
  return (
    <span className={className ?? (usd === 0 ? "text-slate-400" : "text-yellow-400")}>
      {text}
    </span>
  )
}
