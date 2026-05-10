"use client"

import { use } from "react"
import { useQuery, useQueries } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft, Copy, Download, FileText, Loader2, Printer } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getJob, getJobFiles, getJobFile } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import type { AuditJobResult } from "@/lib/types"

interface PageProps {
  params: Promise<{ job_id: string }>
}

// ── Prose "humain" ─────────────────────────────────────────────────────────
const PROSE_PO = [
  "prose prose-invert max-w-none",
  "prose-headings:tracking-tight prose-headings:font-semibold prose-headings:text-slate-100",
  "prose-h1:text-2xl prose-h1:mb-4",
  "prose-h2:text-xl prose-h2:text-slate-200 prose-h2:mt-8 prose-h2:mb-3",
  "prose-h3:text-base prose-h3:text-blue-300 prose-h3:mt-5 prose-h3:mb-2",
  "prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-sm prose-p:my-2",
  "prose-li:text-slate-300 prose-li:text-sm prose-li:leading-relaxed prose-li:my-1",
  "prose-ul:my-2 prose-ol:my-2 prose-li:marker:text-slate-500",
  "prose-strong:text-slate-100 prose-em:text-slate-400",
  "prose-hr:border-slate-700 prose-hr:my-8",
  "prose-blockquote:border-l-blue-500 prose-blockquote:text-slate-300 prose-blockquote:bg-blue-950/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:not-italic",
  "prose-code:text-blue-300 prose-code:bg-slate-800/80 prose-code:px-1 prose-code:rounded prose-code:text-sm",
  "prose-code:before:content-none prose-code:after:content-none",
  "[&_table]:w-full [&_table]:text-sm [&_table]:border-collapse",
  "[&_thead_tr]:bg-slate-800/70",
  "[&_th]:border [&_th]:border-slate-700 [&_th]:px-3 [&_th]:py-2 [&_th]:text-slate-300 [&_th]:text-left [&_th]:font-medium",
  "[&_td]:border [&_td]:border-slate-800 [&_td]:px-3 [&_td]:py-2 [&_td]:text-slate-300 [&_td]:align-top [&_td]:leading-relaxed [&_td]:break-words [&_td]:whitespace-normal",
  "[&_td_code]:whitespace-pre-wrap [&_td_p]:my-0",
  "[&_tbody_tr:hover_td]:bg-slate-800/25",
].join(" ")

// ── Helpers ────────────────────────────────────────────────────────────────

function isPOFile(path: string) {
  return path.includes("_brief_po") || path.includes("gaps_complets")
}

function fileOrder(path: string): number {
  if (path.includes("_brief_po")) return 0
  if (path.includes("gaps_complets")) return 1
  return 2
}

/** Extrait le contenu d'une section ## depuis un markdown. */
function extractSection(markdown: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i")
  const m = markdown.match(re)
  return m ? m[1].trim() : null
}

/** Compte les items dans une section ## (lignes commençant par - ou chiffre) */
function countSectionItems(markdown: string, heading: string): number {
  const section = extractSection(markdown, heading)
  if (!section) return 0
  return section.split("\n").filter(l => /^[-*\d]/.test(l.trim())).length
}

function downloadMarkdown(content: string, jobId: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `brief_po_${jobId.slice(0, 8)}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Bandeau criticité ──────────────────────────────────────────────────────

interface CriticalityBannerProps {
  result: AuditJobResult
  pendingCount: number
}

function CriticalityBanner({ result, pendingCount }: CriticalityBannerProps) {
  const score = result.health_score ?? 0
  const flagsTotal = result.files.reduce((s, f) => s + f.flags_total, 0)

  const level =
    score >= 80 ? ("faible" as const) :
    score >= 50 ? ("modere" as const) :
    ("critique" as const)

  const cfg = {
    faible: {
      label: "FAIBLE",
      dot: "🟢",
      bg: "bg-green-950/40 border-green-800/50",
      scoreColor: "text-green-400",
    },
    modere: {
      label: "MODÉRÉ",
      dot: "🟠",
      bg: "bg-orange-950/40 border-orange-800/50",
      scoreColor: "text-orange-400",
    },
    critique: {
      label: "CRITIQUE",
      dot: "🔴",
      bg: "bg-red-950/40 border-red-800/50",
      scoreColor: "text-red-400",
    },
  }[level]

  return (
    <div className={`rounded-lg border px-5 py-4 no-print ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-base font-semibold ${cfg.scoreColor}`}>
            {cfg.dot} Criticité {cfg.label} — Score {score}/100
          </p>
          <p className="text-slate-400 text-sm mt-0.5 tabular-nums">
            {flagsTotal} flags détectés
            {pendingCount > 0 && ` · ${pendingCount} question${pendingCount > 1 ? "s" : ""} en attente de validation PO`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">Fichiers analysés</p>
          <p className="text-slate-300 font-semibold tabular-nums">{result.total_files}</p>
        </div>
      </div>
    </div>
  )
}

// ── Résumé exécutif ────────────────────────────────────────────────────────

function ExecutiveSummary({ content }: { content: string }) {
  const summary = extractSection(content, "Résumé exécutif")
  if (!summary) return null

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-6 py-5">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-3">
        Résumé exécutif
      </p>
      <div className={PROSE_PO}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function BriefPage({ params }: PageProps) {
  const { job_id } = use(params)

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job", job_id],
    queryFn: () => getJob(job_id),
    staleTime: 60_000,
  })

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["job-files", job_id],
    queryFn: () => getJobFiles(job_id),
    enabled: job?.status === "success",
    staleTime: 60_000,
  })

  const poFiles = (files ?? [])
    .filter(f => isPOFile(f.path))
    .sort((a, b) => fileOrder(a.path) - fileOrder(b.path))

  const contentResults = useQueries({
    queries: poFiles.map(f => ({
      queryKey: ["job-file", job_id, f.path],
      queryFn: () => getJobFile(job_id, f.path),
      enabled: poFiles.length > 0,
      staleTime: 60_000,
    })),
  })

  const isLoading = jobLoading || filesLoading || contentResults.some(r => r.isLoading)
  const allContent = contentResults.map(r => r.data ?? "").join("\n\n---\n\n")

  // Premier brief_po dispo — pour le résumé exécutif et le compte de questions
  const firstBriefIdx = poFiles.findIndex(f => f.path.includes("_brief_po"))
  const firstBriefContent = firstBriefIdx >= 0 ? (contentResults[firstBriefIdx]?.data ?? "") : ""

  // Compte des questions en attente (sections "Questions à valider")
  const pendingCount = poFiles.reduce((sum, f, i) => {
    if (!f.path.includes("_brief_po")) return sum
    const content = contentResults[i]?.data ?? ""
    return sum + countSectionItems(content, "Questions à valider")
  }, 0)

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    toast.success("Lien copié")
  }

  if (jobLoading) return <BriefSkeleton />

  if (job?.status !== "success") {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <p className="text-slate-400 text-sm">
          Ce brief n&apos;est disponible qu&apos;une fois l&apos;audit terminé.
        </p>
        <Link href={`/jobs/${job_id}`} className="mt-4 inline-block text-blue-400 text-sm hover:underline">
          ← Voir le job
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5 pb-16">

      {/* ── Header navigation + actions ── */}
      <div className="flex items-center justify-between gap-4 pt-2 no-print">
        <Link
          href={`/jobs/${job_id}`}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Cockpit
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={copyLink}
            className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copier le lien
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => window.print()}
            className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={!allContent || isLoading}
            onClick={() => downloadMarkdown(allContent, job_id)}
            className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            .md
          </Button>
        </div>
      </div>

      {/* ── Meta : job ID + date ── */}
      <div className="border border-slate-800 rounded-lg bg-slate-900/60 px-5 py-3 flex items-center justify-between gap-4 no-print">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Vue PO — Rosetta Audit</p>
          <p className="text-slate-400 text-xs font-mono">{job_id}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Terminé le</p>
          <p className="text-sm text-slate-300">{job.finished_at ? formatDate(job.finished_at) : "—"}</p>
        </div>
      </div>

      {/* ── Bandeau criticité ── */}
      {job.result && (
        <CriticalityBanner result={job.result} pendingCount={pendingCount} />
      )}

      {/* ── Contenu ── */}
      {isLoading ? (
        <div className="flex flex-col gap-3 mt-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-5 w-full bg-slate-800" />
          ))}
        </div>
      ) : poFiles.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-8 py-12 flex flex-col items-center gap-3 text-center">
          <FileText className="h-7 w-7 text-slate-600" />
          <p className="text-slate-400 text-sm">Aucun brief PO généré pour ce job.</p>
          <p className="text-slate-600 text-xs max-w-sm">
            Les briefs sont produits lors d&apos;une analyse LLM. Relance le job avec LLM activé.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Résumé exécutif en premier, hors du flux normal */}
          {firstBriefContent && (
            <ExecutiveSummary content={firstBriefContent} />
          )}

          {/* Contenu complet des fichiers */}
          {contentResults.map((result, i) => (
            result.data ? (
              <section key={poFiles[i].path}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                    {poFiles[i].label}
                  </span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
                <div className={PROSE_PO}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.data}
                  </ReactMarkdown>
                </div>
              </section>
            ) : (
              <div key={poFiles[i].path} className="flex items-center gap-2 text-slate-600 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Chargement {poFiles[i].label}…
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}

function BriefSkeleton() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24 bg-slate-800" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 bg-slate-800" />
          <Skeleton className="h-8 w-16 bg-slate-800" />
          <Skeleton className="h-8 w-16 bg-slate-800" />
        </div>
      </div>
      <Skeleton className="h-16 w-full bg-slate-800 rounded-lg" />
      <Skeleton className="h-20 w-full bg-red-950/30 rounded-lg" />
      <Skeleton className="h-32 w-full bg-slate-800/60 rounded-lg" />
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className={`h-4 bg-slate-800 ${i % 3 === 0 ? "w-3/4" : "w-full"}`} />
      ))}
    </div>
  )
}
