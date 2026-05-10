"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { getJobFiles, getJobFile } from "@/lib/api"
import { cn } from "@/lib/utils"

interface OutputsTabProps {
  jobId: string
}

export function OutputsTab({ jobId }: OutputsTabProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["job-files", jobId],
    queryFn: () => getJobFiles(jobId),
    staleTime: 60_000,
  })

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["job-file", jobId, selectedPath],
    queryFn: () => getJobFile(jobId, selectedPath!),
    enabled: selectedPath !== null,
    staleTime: 60_000,
  })

  if (filesLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full bg-slate-800" />
        ))}
      </div>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-10 text-center">
        <p className="text-slate-500 text-sm">Aucun fichier généré pour ce job.</p>
      </div>
    )
  }

  const active = selectedPath ?? files[0].path

  return (
    <div className="flex gap-0 rounded-md border border-slate-800 overflow-hidden min-h-[480px]">
      {/* Sidebar — liste des fichiers */}
      <div className="w-52 shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => setSelectedPath(f.path)}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors border-b border-slate-800/50",
              active === f.path
                ? "bg-slate-800 text-slate-100 border-l-2 border-l-blue-500"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu markdown */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        {contentLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : content ? (
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-slate-100 prose-headings:font-semibold
            prose-p:text-slate-300 prose-p:leading-relaxed
            prose-code:text-blue-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded prose-code:text-xs
            prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700
            prose-strong:text-slate-100
            prose-a:text-blue-400
            prose-li:text-slate-300
            prose-table:text-slate-300
            prose-thead:border-slate-700 prose-tr:border-slate-800
            prose-th:text-slate-400 prose-th:font-medium
            prose-blockquote:border-slate-700 prose-blockquote:text-slate-400
            prose-hr:border-slate-800"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-600 text-sm">Sélectionne un fichier</p>
          </div>
        )}
      </div>
    </div>
  )
}
