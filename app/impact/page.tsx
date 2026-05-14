"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, ChevronDown, ChevronUp } from "lucide-react"
import { getImpactTokens } from "@/lib/api"
import type { ImpactToken, ImpactOccurrence } from "@/lib/types"
import { cn } from "@/lib/utils"

// ── Détail d'un token ─────────────────────────────────────────────────────

function groupByFile(occurrences: ImpactOccurrence[]): Record<string, ImpactOccurrence[]> {
  const groups: Record<string, ImpactOccurrence[]> = {}
  for (const occ of occurrences) {
    const key = occ.fichier || "(inconnu)"
    if (!groups[key]) groups[key] = []
    groups[key].push(occ)
  }
  return groups
}

function DetailPanel({ name, data }: { name: string; data: ImpactToken }) {
  const groups = groupByFile(data.occurrences)
  return (
    <div className="mt-2 mb-4 ml-2 border-l-2 border-blue-500/30 pl-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm font-semibold text-slate-100">{name}</span>
        {data.kb_known && (
          <span className="text-xs px-1.5 py-0.5 rounded border bg-green-500/15 text-green-400 border-green-500/30 font-medium">
            📚 KB
          </span>
        )}
        <span className="text-xs text-slate-500">
          {data.total_occurrences} occurrence{data.total_occurrences > 1 ? "s" : ""} ·{" "}
          {data.distinct_files} fichier{data.distinct_files > 1 ? "s" : ""}
        </span>
        {data.sources.length > 0 && (
          <span className="text-xs text-slate-600">
            via : {data.sources.join(", ")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {Object.entries(groups).map(([fichier, occs]) => (
          <div key={fichier}>
            <p className="text-xs font-mono text-blue-300 mb-1">
              📄 {fichier}
            </p>
            <ul className="flex flex-col gap-0.5 ml-4">
              {occs.map((occ, i) => (
                <li key={i} className="text-xs text-slate-400 font-mono">
                  {occ.methode ? (
                    <>
                      <span className="text-slate-500">::</span>
                      <span className="text-slate-300">{occ.methode}</span>
                      {occ.ligne != null && (
                        <span className="text-slate-600">:{occ.ligne}</span>
                      )}
                    </>
                  ) : occ.ligne != null ? (
                    <span className="text-slate-600">ligne {occ.ligne}</span>
                  ) : (
                    <span className="text-slate-700 italic">position inconnue</span>
                  )}
                  <span className="ml-2 text-slate-700">({occ.source})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Ligne token ───────────────────────────────────────────────────────────

function TokenRow({
  name,
  data,
  maxOcc,
  selected,
  onToggle,
}: {
  name: string
  data: ImpactToken
  maxOcc: number
  selected: boolean
  onToggle: () => void
}) {
  const pct = maxOcc > 0 ? Math.round((data.total_occurrences / maxOcc) * 100) : 0

  return (
    <>
      <div
        onClick={onToggle}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
          selected
            ? "border-blue-500/40 bg-blue-500/5"
            : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/30",
        )}
      >
        <span className="w-5 text-sm text-center">
          {data.kb_known ? "📚" : ""}
        </span>

        <span className="font-mono text-sm text-slate-200 w-40 truncate" title={name}>
          {name}
        </span>

        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              data.kb_known ? "bg-blue-500" : "bg-slate-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <span className="text-xs text-slate-500 w-28 text-right tabular-nums shrink-0">
          {data.total_occurrences} occ. / {data.distinct_files}f
        </span>

        <span className="text-slate-600 w-4">
          {selected
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </div>

      {selected && <DetailPanel name={name} data={data} />}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ImpactPage() {
  const [search, setSearch]   = useState("")
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["impact-tokens", search],
    queryFn: () => getImpactTokens({ search: search || undefined, minOccurrences: 1 }),
    staleTime: 60_000,
  })

  const entries = Object.entries(data?.tokens ?? {})
  const maxOcc  = Math.max(...entries.map(([, d]) => d.total_occurrences), 1)
  const kbCount = entries.filter(([, d]) => d.kb_known).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Impact cross-fichier</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isLoading ? "Chargement…" : (
            <>
              <span className="text-slate-300 font-medium">{entries.length}</span> token{entries.length > 1 ? "s" : ""} référencé{entries.length > 1 ? "s" : ""}
              {" "}dans{" "}
              <span className="text-slate-300 font-medium">{data?.ir_count ?? 0}</span> IR{(data?.ir_count ?? 0) > 1 ? "s" : ""} analysé{(data?.ir_count ?? 0) > 1 ? "s" : ""}
              {kbCount > 0 && (
                <> · <span className="text-green-400 font-medium">{kbCount} connus en KB</span></>
              )}
            </>
          )}
        </p>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Rechercher un token (DSLAM, TP2, C_TYP_FLX…)"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null) }}
          className="w-full rounded-md border border-slate-700 bg-slate-800 pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-slate-600 text-sm">
          {search
            ? `Aucun token correspondant à "${search}"`
            : "Aucune donnée d'impact disponible. Lancez des analyses avec --kb-root pour extraire les relations."}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map(([name, token]) => (
            <TokenRow
              key={name}
              name={name}
              data={token}
              maxOcc={maxOcc}
              selected={selected === name}
              onToggle={() => setSelected(selected === name ? null : name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
