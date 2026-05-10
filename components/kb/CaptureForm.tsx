"use client"

import { useState, useEffect, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { captureCode } from "@/lib/api"
import type { CaptureRequest, KBEntry } from "@/lib/types"

const INITIAL: CaptureRequest = {
  code: "",
  label: "",
  source: "",
  confiance: "medium",
  domain: "commun",
  notes: "",
}

interface CaptureFormProps {
  editEntry?: KBEntry | null
  onClearEdit?: () => void
}

export function CaptureForm({ editEntry, onClearEdit }: CaptureFormProps) {
  const [form, setForm] = useState<CaptureRequest>(INITIAL)
  const [success, setSuccess] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const isEditMode = editEntry != null

  // Quand une entrée est passée depuis la table, pré-remplir le formulaire
  useEffect(() => {
    if (editEntry) {
      setForm({
        code: editEntry.code,
        label: editEntry.label,
        source: editEntry.source || "",
        confiance: editEntry.confiance,
        domain: editEntry.domaine,
        notes: editEntry.notes || "",
        force: true,
      })
      setSuccess(null)
      // Scroll vers le formulaire
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      setForm(INITIAL)
    }
  }, [editEntry])

  const mutation = useMutation({
    mutationFn: captureCode,
    onSuccess: (data) => {
      setSuccess(`✓ ${data.action} — ${data.code} (${data.confiance})`)
      if (!isEditMode) setForm(INITIAL)
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] })
      queryClient.invalidateQueries({ queryKey: ["kb-entries"] })
    },
  })

  const field = (key: keyof CaptureRequest) => ({
    value: String(form[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  function handleClear() {
    setForm(INITIAL)
    setSuccess(null)
    onClearEdit?.()
  }

  return (
    <Card className="bg-slate-900 border-slate-800" ref={formRef as React.Ref<HTMLDivElement>}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-slate-300">
            {isEditMode ? (
              <>
                Enrichir <span className="font-mono text-blue-400">{editEntry.code}</span>
              </>
            ) : (
              "Capturer un code métier"
            )}
          </CardTitle>
          {isEditMode && (
            <button
              onClick={handleClear}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Annuler l'édition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {isEditMode && (
          <p className="text-xs text-slate-500 mt-1">
            Mode enrichissement — le code est verrouillé.
            Complète les notes et passe la confiance à <span className="text-green-400">high</span> si validé PO.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccess(null)
            mutation.mutate({ ...form, force: isEditMode })
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code *">
              <input
                required
                placeholder="EX: TP2"
                className={isEditMode ? inputClassReadonly : inputClass}
                readOnly={isEditMode}
                {...field("code")}
              />
            </Field>
            <Field label="Domaine *">
              <input
                required
                placeholder="commun"
                className={inputClass}
                {...field("domain")}
              />
            </Field>
          </div>

          <Field label="Label *">
            <input
              required
              placeholder="Description métier claire"
              className={inputClass}
              {...field("label")}
            />
          </Field>

          <Field label="Source *">
            <input
              required
              placeholder="PO validé — 2026-05-10"
              className={inputClass}
              {...field("source")}
            />
          </Field>

          <Field label="Confiance">
            <select className={inputClass} {...field("confiance")}>
              <option value="medium">medium</option>
              <option value="inferred">inferred</option>
              <option value="high">high (PO uniquement)</option>
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              rows={isEditMode ? 5 : 2}
              placeholder={isEditMode
                ? "Réponds aux questions À valider PO… puis passe la confiance à high."
                : "Contexte, couplages, format…"
              }
              className={inputClass}
              {...field("notes")}
            />
          </Field>

          {mutation.isError && (
            <Alert variant="destructive" className="border-red-800 bg-red-950">
              <AlertDescription>
                {mutation.error instanceof Error ? mutation.error.message : "Erreur API"}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <p className="text-sm text-green-400">{success}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-blue-700 hover:bg-blue-600 text-white"
            >
              {mutation.isPending
                ? (isEditMode ? "Enregistrement…" : "Capture…")
                : (isEditMode ? "Enregistrer" : "Capturer")
              }
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                className="border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                Annuler
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

const inputClass =
  "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"

const inputClassReadonly =
  "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400 font-mono cursor-not-allowed select-all"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
