"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, Loader2, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { getJobFiles, getJobFile } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { AuditJobResult } from "@/lib/types"

interface OutputsTabProps {
  jobId: string
  result: AuditJobResult
}

function isNoLlm(result: AuditJobResult) {
  return result.files.length > 0 && result.files.every(f => f.status === "no_llm")
}

/* Classes prose "Technical Dashboard" — dense, pas "article de blog" */
const PROSE = [
  "prose prose-invert prose-sm max-w-none",

  // Headings — compacts, tracking tight
  "prose-headings:tracking-tight prose-headings:font-semibold",
  "prose-headings:text-slate-100",
  "prose-headings:mt-4 prose-headings:mb-1",
  "prose-h1:text-sm prose-h2:text-xs prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-slate-400",
  "prose-h3:text-xs prose-h3:text-blue-300 prose-h3:uppercase prose-h3:tracking-widest",

  // Body — paragraphes serrés
  "prose-p:text-slate-300 prose-p:text-xs prose-p:leading-snug prose-p:my-1",
  "prose-strong:text-slate-100",
  "prose-em:text-slate-400",
  "prose-li:text-slate-300 prose-li:text-xs prose-li:my-0.5 prose-li:marker:text-slate-600",
  "prose-ul:my-1 prose-ol:my-1",
  "prose-hr:border-slate-800 prose-hr:my-3",
  "prose-blockquote:border-l-slate-700 prose-blockquote:text-slate-400 prose-blockquote:text-xs prose-blockquote:py-0.5",
  "prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline",

  // Code inline — discret
  "prose-code:text-blue-300 prose-code:bg-slate-800/80 prose-code:px-1 prose-code:py-0 prose-code:rounded prose-code:text-xs",
  "prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700 prose-pre:text-xs prose-pre:overflow-x-auto prose-pre:my-2",

  // Tables — "dashboard technique"
  // wrapper scrollable
  "[&_table]:block [&_table]:overflow-x-auto",
  // layout auto = colonnes au contenu, pas étirées
  "[&_table]:w-full [&_table]:text-xs [&_table]:border-collapse",
  // header
  "[&_thead_tr]:bg-slate-800/70",
  "[&_th]:border [&_th]:border-slate-700 [&_th]:px-2 [&_th]:py-1",
  "[&_th]:text-slate-400 [&_th]:font-medium [&_th]:text-left [&_th]:whitespace-nowrap [&_th]:tracking-wide",
  // cellules
  "[&_td]:border [&_td]:border-slate-800 [&_td]:px-2 [&_td]:py-1",
  "[&_td]:text-slate-300 [&_td]:align-top [&_td]:leading-snug",
  // chiffres — alignés à droite via attribut GFM ou heuristique
  "[&_td:last-child]:text-right [&_th:last-child]:text-right",
  // hover ligne
  "[&_tbody_tr:hover_td]:bg-slate-800/25",
].join(" ")

export function OutputsTab({ jobId, result }: OutputsTabProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["job-files", jobId],
    queryFn: () => getJobFiles(jobId),
    staleTime: 60_000,
  })

  const activePath = selectedPath ?? files?.[0]?.path ?? null

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["job-file", jobId, activePath],
    queryFn: () => getJobFile(jobId, activePath!),
    enabled: activePath !== null,
    staleTime: 60_000,
  })

  if (filesLoading) {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-md border border-slate-800 bg-slate-900">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-full bg-slate-800" />
        ))}
      </div>
    )
  }

  if (!files || files.length === 0) {
    if (isNoLlm(result)) {
      return (
        <div className="rounded-md border border-slate-800 bg-slate-900 px-8 py-12 flex flex-col items-center gap-3 text-center">
          <Sparkles className="h-7 w-7 text-slate-600" />
          <p className="text-slate-300 text-sm font-medium tracking-tight">
            Mode no-llm — aucun fichier de sortie généré
          </p>
          <p className="text-slate-500 text-xs max-w-sm leading-relaxed">
            Les documents (Brief PO, Doc métier, Gaps) sont produits uniquement
            lors d&apos;une analyse LLM. Utilise{" "}
            <span className="text-blue-400 font-medium">Relancer avec LLM</span>{" "}
            en haut à droite.
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-10 text-center">
        <p className="text-slate-500 text-sm">Aucun fichier généré pour ce job.</p>
      </div>
    )
  }

  return (
    <div className="flex rounded-md border border-slate-800 overflow-hidden" style={{ minHeight: "560px" }}>
      {/* Sidebar — 160px fixe */}
      <div className="shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col" style={{ width: "160px" }}>
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => setSelectedPath(f.path)}
            className={cn(
              "flex items-start gap-2 px-3 py-2 text-xs text-left transition-colors border-b border-slate-800/60",
              activePath === f.path
                ? "bg-slate-800 text-slate-100 border-l-2 border-l-blue-500"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
            )}
          >
            <FileText className="h-3 w-3 shrink-0 text-slate-500 mt-0.5" />
            <span className="leading-snug break-words">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu — flex-1 prend tout le reste */}
      <div className="flex-1 min-w-0 overflow-auto bg-slate-950 px-6 py-4">
        {contentLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          </div>
        ) : content ? (
          <div className={PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className="text-slate-600 text-xs">Sélectionne un fichier</p>
          </div>
        )}
      </div>
    </div>
  )
}
