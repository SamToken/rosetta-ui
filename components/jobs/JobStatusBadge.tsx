import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"
import type { JobStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  queued: {
    label: "En file",
    className: "bg-slate-700 text-slate-200 border-slate-600",
    icon: Clock,
  },
  running: {
    label: "En cours",
    className: "bg-blue-900 text-blue-200 border-blue-700",
    icon: Loader2,
  },
  success: {
    label: "Succès",
    className: "bg-green-900 text-green-200 border-green-700",
    icon: CheckCircle2,
  },
  error: {
    label: "Erreur",
    className: "bg-red-900 text-red-200 border-red-700",
    icon: XCircle,
  },
}

interface JobStatusBadgeProps {
  status: JobStatus
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const { label, className, icon: Icon } = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn("flex w-fit items-center gap-1.5 px-2 py-0.5", className)}>
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          status === "running" && "animate-spin",
        )}
      />
      {label}
    </Badge>
  )
}
