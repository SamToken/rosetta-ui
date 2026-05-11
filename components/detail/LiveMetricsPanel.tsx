"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// ── Parseurs logs ──────────────────────────────────────────────────────────

const RE_PROGRESS  = /^\[(\d+)\/(\d+)\]/
const RE_COMPLETED = /^\[(\d+)\/(\d+)\]\s+.+✓/
const RE_INSIGHTS  = /✓\s+(\d+)\s+insights?\s+générés/i
const RE_COVERAGE  = /Couverture KB\s*:\s*([\d.]+)%/i
const RE_TO_ENRICH = /→\s*À enrichir en KB\s*:\s*(.+)/i
const RE_TOKEN     = /(\w+)\((\d+)[x×]\)/g

interface EnrichToken { code: string; count: number }

interface Parsed {
  filesCompleted: number
  totalFiles: number
  totalInsights: number
  kbCoverages: number[]
  enrichTokens: EnrichToken[]
}

function parseLogs(logs: string[]): Parsed {
  let filesCompleted = 0
  let totalFiles = 0
  let totalInsights = 0
  const kbCoverages: number[] = []
  const enrichTokens: EnrichToken[] = []
  const seenTokens = new Set<string>()

  for (const line of logs) {
    const prog = line.match(RE_PROGRESS)
    if (prog) {
      totalFiles = parseInt(prog[2])
      if (RE_COMPLETED.test(line)) filesCompleted = parseInt(prog[1])
    }
    const ins = line.match(RE_INSIGHTS)
    if (ins) totalInsights += parseInt(ins[1])

    const cov = line.match(RE_COVERAGE)
    if (cov) kbCoverages.push(parseFloat(cov[1]))

    const enrich = line.match(RE_TO_ENRICH)
    if (enrich) {
      for (const tok of enrich[1].matchAll(RE_TOKEN)) {
        if (!seenTokens.has(tok[1])) {
          seenTokens.add(tok[1])
          enrichTokens.push({ code: tok[1], count: parseInt(tok[2]) })
        }
      }
    }
  }

  return { filesCompleted, totalFiles, totalInsights, kbCoverages, enrichTokens }
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ── Composant ──────────────────────────────────────────────────────────────

interface LiveMetricsPanelProps {
  logs: string[]
  startedAt: string | null
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <div className="text-sm text-slate-200">{children}</div>
    </div>
  )
}

export function LiveMetricsPanel({ logs, startedAt }: LiveMetricsPanelProps) {
  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const { filesCompleted, totalFiles, totalInsights, kbCoverages, enrichTokens } = parseLogs(logs)

  const avgCoverage = kbCoverages.length > 0
    ? Math.round(kbCoverages.reduce((s, v) => s + v, 0) / kbCoverages.length)
    : null

  const kbColor =
    avgCoverage == null ? "text-slate-500" :
    avgCoverage >= 50   ? "text-green-400" :
    avgCoverage >= 20   ? "text-yellow-400" :
    "text-red-400"

  return (
    <Card className="bg-slate-900 border-slate-800 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
          Métriques
          <span className="text-[10px] text-orange-400 border border-orange-500/30 rounded px-1.5 py-0.5 font-medium animate-pulse">
            ⏱ en cours
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">

        <Row label="Fichiers analysés">
          {totalFiles > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold">
                {filesCompleted}
                <span className="text-slate-500">/{totalFiles}</span>
              </span>
              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-700"
                  style={{ width: `${Math.round((filesCompleted / totalFiles) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-slate-600 text-xs">En attente…</span>
          )}
        </Row>

        <Row label="Insights extraits">
          {totalInsights > 0 ? (
            <span className="font-semibold">{totalInsights}</span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
        </Row>

        <Row label="Coût LLM">
          <span className="text-slate-600 text-xs">disponible à la fin</span>
        </Row>

        <Row label="Durée">
          <span className="font-semibold tabular-nums">
            {elapsed > 0 ? formatElapsed(elapsed) : "—"}
          </span>
        </Row>

        {/* KB Coverage — mis en avant */}
        {avgCoverage != null ? (
          <div className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2.5 flex flex-col gap-1">
            <span className="text-xs text-slate-500 uppercase tracking-wide">🧠 KB Coverage</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-bold tabular-nums ${kbColor}`}>{avgCoverage}%</span>
              <span className="text-xs text-slate-500">moy. / {kbCoverages.length} fichier{kbCoverages.length > 1 ? "s" : ""}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              flags résolus sans LLM
            </p>
          </div>
        ) : (
          <Row label="KB Coverage">
            <span className="text-slate-600 text-xs">—</span>
          </Row>
        )}

        <Row label="Health Score">
          <span className="text-slate-600 text-xs">disponible à la fin</span>
        </Row>

        {/* Tokens à enrichir — cliquables → KB capture */}
        {enrichTokens.length > 0 && (
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 flex flex-col gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">→ À enrichir en KB</span>
            <div className="flex flex-wrap gap-1.5">
              {enrichTokens.map(({ code, count }) => (
                <button
                  key={code}
                  onClick={() => router.push(`/kb?code=${encodeURIComponent(code)}`)}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-600/40 bg-blue-600/10 px-2.5 py-0.5 text-xs text-blue-300 hover:bg-blue-600/20 hover:text-blue-200 transition-colors cursor-pointer"
                  title={`Capturer "${code}" dans le KB`}
                >
                  <span className="font-mono font-semibold">{code}</span>
                  <span className="text-blue-500/70 tabular-nums">{count}×</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 leading-tight">clic → pré-remplit le formulaire KB</p>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
