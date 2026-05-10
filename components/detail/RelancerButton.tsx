"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { startAudit } from "@/lib/api"
import type { AuditJobResult } from "@/lib/types"

interface RelancerButtonProps {
  result: AuditJobResult
}

function isNoLlmJob(result: AuditJobResult): boolean {
  return result.files.length > 0 && result.files.every(f => f.status === "no_llm")
}

export function RelancerButton({ result }: RelancerButtonProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  if (!isNoLlmJob(result)) return null

  const phpPaths = result.php_paths ?? []
  const haspaths = phpPaths.length > 0

  const mutation = useMutation({
    mutationFn: () =>
      startAudit({
        php_paths: phpPaths,
        no_llm: false,
        max_workers: Math.min(phpPaths.length, 4),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job LLM lancé", {
        description: `${phpPaths.length} fichier(s) en file`,
      })
      router.push(`/jobs/${data.job_id}`)
    },
    onError: (err) => {
      toast.error("Échec du lancement", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      })
    },
  })

  const button = (
    <Button
      size="sm"
      onClick={() => haspaths && mutation.mutate()}
      disabled={!haspaths || mutation.isPending}
      className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
    >
      {mutation.isPending ? (
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Lancement…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Relancer avec LLM
        </span>
      )}
    </Button>
  )

  if (!haspaths) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          {button}
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="bg-slate-800 border-slate-700 text-slate-200 text-xs max-w-52"
        >
          Chemin non stocké — utilise &quot;Nouvel audit&quot; avec LLM activé
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}
