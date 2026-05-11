"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getJob } from "@/lib/api"
import type { JobStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

interface LiveTerminalProps {
  jobId: string
  initialLogs: string[]
  initialStatus: JobStatus
}

const RE_KB_COVERAGE = /Couverture KB\s*:\s*([\d.]+)%/i

function lineColor(line: string): string {
  if (line.includes("✓") || line.includes("✅")) return "text-green-400"
  if (line.includes("⚠") || line.includes("⚠️")) return "text-orange-400"
  if (line.includes("✗") || line.includes("❌")) return "text-red-400"
  if (line.includes("📊") || line.includes("📂") || line.includes("📄"))
    return "text-blue-400"
  return "text-slate-400"
}

function isKbCoverageLine(line: string): boolean {
  return RE_KB_COVERAGE.test(line)
}

function isSummaryLine(line: string): boolean {
  if (!line.trim()) return false
  // Progression fichier [N/M] non-indenté
  if (/^\[(\d+)\/(\d+)\]/.test(line)) return true
  // Signaux clés
  if (line.includes("✓") || line.includes("✅")) return true
  if (line.includes("⚠") || line.includes("⚠️")) return true
  if (line.includes("❌") || line.includes("✗")) return true
  if (line.includes("📊") || line.includes("📄")) return true
  if (/couverture kb/i.test(line)) return true
  if (/insight/i.test(line)) return true
  if (/à enrichir/i.test(line)) return true
  if (/brief/i.test(line)) return true
  if (/health/i.test(line)) return true
  if (/erreur|error/i.test(line)) return true
  return false
}

export function LiveTerminal({
  jobId,
  initialLogs,
  initialStatus,
}: LiveTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<"summary" | "detail">("summary")

  const { data } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? initialStatus
      return status === "running" || status === "queued" ? 2000 : false
    },
    initialData: undefined,
  })

  const logs = data?.logs ?? initialLogs
  const displayedLogs = mode === "summary" ? logs.filter(isSummaryLine) : logs

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [displayedLogs.length])

  return (
    <div className="flex flex-col gap-0">
      {/* Barre de mode */}
      <div className="flex items-center gap-1 px-3 py-1.5 border border-b-0 border-slate-800 rounded-t-md bg-slate-900">
        {(["summary", "detail"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-2.5 py-0.5 rounded text-xs font-medium transition-colors",
              mode === m
                ? "bg-slate-700 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            {m === "summary" ? "Résumé" : "Détail"}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-700 tabular-nums">
          {mode === "summary"
            ? `${displayedLogs.length}/${logs.length} lignes`
            : `${logs.length} lignes`}
        </span>
      </div>

      {/* Terminal */}
      <div className="min-h-[380px] max-h-[480px] rounded-b-md bg-black border border-slate-800 overflow-y-auto p-4 font-mono text-xs leading-5">
        {displayedLogs.length === 0 ? (
          <span className="text-slate-600">
            {logs.length === 0 ? "En attente de logs…" : "Aucune ligne clé pour l'instant…"}
          </span>
        ) : (
          displayedLogs.map((line, i) =>
            isKbCoverageLine(line) ? (
              <div
                key={i}
                className="my-1 rounded border-l-2 border-blue-500 bg-blue-500/10 px-2 py-1 text-blue-300 font-semibold whitespace-pre-wrap break-words"
              >
                {line}
              </div>
            ) : (
              <div key={i} className={cn("whitespace-pre-wrap break-all", lineColor(line))}>
                {line || " "}
              </div>
            )
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
