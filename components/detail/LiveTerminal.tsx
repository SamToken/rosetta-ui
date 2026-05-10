"use client"

import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { getJob } from "@/lib/api"
import type { JobStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

interface LiveTerminalProps {
  jobId: string
  initialLogs: string[]
  initialStatus: JobStatus
}

function lineColor(line: string): string {
  if (line.includes("✓") || line.includes("✅")) return "text-green-400"
  if (line.includes("⚠") || line.includes("⚠️")) return "text-orange-400"
  if (line.includes("✗") || line.includes("❌")) return "text-red-400"
  if (line.includes("📊") || line.includes("📂") || line.includes("📄"))
    return "text-blue-400"
  return "text-slate-400"
}

export function LiveTerminal({
  jobId,
  initialLogs,
  initialStatus,
}: LiveTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId),
    // Polling uniquement si le job est actif
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? initialStatus
      return status === "running" || status === "queued" ? 2000 : false
    },
    // Données initiales injectées depuis le Server Component parent
    initialData: undefined,
  })

  const logs = data?.logs ?? initialLogs

  // Auto-scroll à chaque nouveau log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs.length])

  return (
    <div className="h-full min-h-[400px] rounded-md bg-black border border-slate-800 overflow-y-auto p-4 font-mono text-xs leading-5">
      {logs.length === 0 ? (
        <span className="text-slate-600">En attente de logs…</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} className={cn("whitespace-pre-wrap break-all", lineColor(line))}>
            {line || " " /* ligne vide → espace insécable pour garder la hauteur */}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
