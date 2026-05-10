"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  if (!isNoLlmJob(result) || result.php_paths.length === 0) return null

  const mutation = useMutation({
    mutationFn: () =>
      startAudit({
        php_paths: result.php_paths,
        no_llm: false,
        max_workers: Math.min(result.php_paths.length, 4),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job LLM lancé", {
        description: `${result.php_paths.length} fichier(s) en file`,
      })
      router.push(`/jobs/${data.job_id}`)
    },
    onError: (err) => {
      toast.error("Échec du lancement", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      })
    },
  })

  return (
    <Button
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
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
}
