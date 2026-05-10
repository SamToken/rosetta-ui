"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Play, Folder, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { startAudit } from "@/lib/api"

export function JobLauncher() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState("")
  const [useLlm, setUseLlm] = useState(true)
  const [maxWorkers, setMaxWorkers] = useState(4)

  const mutation = useMutation({
    mutationFn: () =>
      startAudit({
        php_paths: [path.trim()],
        no_llm: !useLlm,
        max_workers: maxWorkers,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      setOpen(false)
      toast.success(`Job ${data.job_id.slice(0, 8)}… lancé`, {
        description: path.trim(),
      })
      router.push(`/jobs/${data.job_id}`)
    },
    onError: (err) => {
      toast.error("Échec du lancement", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!path.trim()) return
    mutation.mutate()
  }

  function handleWorkerChange(v: number | readonly number[]) {
    const val = typeof v === "number" ? v : v[0]
    if (val !== undefined) setMaxWorkers(val)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
        <Play className="h-3.5 w-3.5" />
        Nouvel audit
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Settings2 className="h-4 w-4 text-blue-400" />
            Lancer un audit
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
          {/* Path */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-path" className="text-xs text-slate-400 uppercase tracking-wide">
              <Folder className="inline h-3.5 w-3.5 mr-1 mb-0.5" />
              Chemin PHP
            </Label>
            <Input
              id="audit-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/nixos/projects/astro/application/src/…"
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* LLM toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="audit-llm" className="text-sm text-slate-200">
                Enrichissement LLM
              </Label>
              <span className="text-xs text-slate-500">
                {useLlm ? "Analyse complète — coût API" : "Déterministe uniquement — gratuit"}
              </span>
            </div>
            <Switch
              id="audit-llm"
              checked={useLlm}
              onCheckedChange={setUseLlm}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>

          {/* max_workers */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-400 uppercase tracking-wide">
                Workers parallèles
              </Label>
              <span className="text-sm font-mono text-blue-400">{maxWorkers}</span>
            </div>
            <Slider
              min={1}
              max={16}
              step={1}
              value={[maxWorkers]}
              onValueChange={handleWorkerChange}
            />
            <div className="flex justify-between text-xs text-slate-600">
              <span>1</span>
              <span>16</span>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!path.trim() || mutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 mt-1"
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Lancement…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-3.5 w-3.5" />
                Lancer l&apos;audit
              </span>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
