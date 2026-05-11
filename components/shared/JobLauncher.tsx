"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Play, Folder, Settings2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { startAudit } from "@/lib/api"

const LS_KEY = "rosetta-last-path"

const PRESETS = [
  { label: "Windows WSL", path: "/mnt/c/wamp/www/Infocentre/astro/application/src/" },
  { label: "NixOS", path: "/home/nixos/projects/astro/application/src/" },
]

export function JobLauncher() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState("")
  const [useLlm, setUseLlm] = useState(true)
  const [maxWorkers, setMaxWorkers] = useState(4)

  // Recharge depuis localStorage à chaque ouverture du dialog
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(LS_KEY)
      setPath(saved ?? "")
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => {
      return startAudit({
        php_paths: validPaths,
        no_llm: !useLlm,
        max_workers: maxWorkers,
      })
    },
    onSuccess: (data) => {
      localStorage.setItem(LS_KEY, path.trim())
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

  // Split par virgule OU newline, trim, déduplique les vides
  const validPaths = path.split(/[,\n]/).map(p => p.trim()).filter(Boolean)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validPaths.length === 0) return
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

      <DialogContent className="sm:max-w-xl bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Settings2 className="h-4 w-4 text-blue-400" />
            Lancer un audit
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
          {/* Path */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="audit-path" className="text-xs text-slate-400 uppercase tracking-wide">
                <Folder className="inline h-3.5 w-3.5 mr-1 mb-0.5" />
                Chemins PHP <span className="normal-case text-slate-600 ml-1">(un par ligne ou séparés par virgule)</span>
              </Label>
              {/* Presets */}
              <div className="flex gap-1">
                {PRESETS.map((p) => {
                  const lines = path.split('\n').map(l => l.trim())
                  const active = lines.includes(p.path)
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPath(prev => {
                        const trimmed = prev.trim()
                        if (!trimmed) return p.path
                        if (trimmed.split('\n').map(l => l.trim()).includes(p.path)) return prev
                        return trimmed + '\n' + p.path
                      })}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        active
                          ? "border-blue-500 bg-blue-600/20 text-blue-300"
                          : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <textarea
              id="audit-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder={"/mnt/c/…/RetablirCloturerController.php\n/mnt/c/…/RetablirCloturerIhmService.php\n/mnt/c/…/RetablirCloturerForm.php"}
              rows={8}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px]"
              autoComplete="off"
              spellCheck={false}
            />
            {validPaths.length > 0 && (
              <p className="text-xs text-slate-500 tabular-nums">
                {validPaths.length} chemin{validPaths.length > 1 ? "s" : ""} détecté{validPaths.length > 1 ? "s" : ""}
              </p>
            )}
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
            disabled={validPaths.length === 0 || mutation.isPending}
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
