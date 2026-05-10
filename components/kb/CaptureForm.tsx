"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { captureCode } from "@/lib/api"
import type { CaptureRequest } from "@/lib/types"

const INITIAL: CaptureRequest = {
  code: "",
  label: "",
  source: "",
  confiance: "medium",
  domain: "commun",
  notes: "",
}

export function CaptureForm() {
  const [form, setForm] = useState<CaptureRequest>(INITIAL)
  const [success, setSuccess] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: captureCode,
    onSuccess: (data) => {
      setSuccess(`✓ ${data.action} — ${data.code} (${data.confiance})`)
      setForm(INITIAL)
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] })
    },
  })

  const field = (key: keyof CaptureRequest) => ({
    value: String(form[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm text-slate-300">Capturer un code métier</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccess(null)
            mutation.mutate(form)
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code *">
              <input
                required
                placeholder="EX: TP2"
                className={inputClass}
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
              rows={2}
              placeholder="Contexte, couplages, format…"
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

          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-blue-700 hover:bg-blue-600 text-white self-start"
          >
            {mutation.isPending ? "Capture…" : "Capturer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

const inputClass =
  "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
