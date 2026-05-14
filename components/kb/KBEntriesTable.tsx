"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Search } from "lucide-react"
import { getKBEntries } from "@/lib/api"
import type { KBEntry, TrouveRef } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface KBEntriesTableProps {
  onEdit: (entry: KBEntry) => void
}

const SECTION_LABELS: Record<string, string> = {
  "codes": "Code",
  "regles": "Règle",
  "sql_artifacts.colonnes": "Colonne",
  "sql_artifacts.vues": "Vue",
  "sql_artifacts.requetes": "Requête",
  "relations": "Relation",
}

const TYPE_FILTER_OPTIONS = [
  { value: "all",                    label: "Tous" },
  { value: "codes",                  label: "Code" },
  { value: "regles",                 label: "Règle" },
  { value: "relations",              label: "Relation" },
  { value: "sql_artifacts.colonnes", label: "Colonne" },
  { value: "sql_artifacts.vues",     label: "Vue" },
  { value: "sql_artifacts.requetes", label: "Requête" },
]

const KIND_STYLES: Record<string, string> = {
  implies:        "bg-blue-900/30 text-blue-400 border-blue-700/40",
  synonym_of:     "bg-purple-900/30 text-purple-400 border-purple-700/40",
  transitions_to: "bg-teal-900/30 text-teal-400 border-teal-700/40",
  requires:       "bg-amber-900/30 text-amber-400 border-amber-700/40",
}

function ConfidenceBadge({ confiance }: { confiance: KBEntry["confiance"] }) {
  const cfg = {
    high:     "bg-green-500/15 text-green-400 border-green-500/30",
    medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    inferred: "bg-slate-700/50 text-slate-400 border-slate-600/30",
  }[confiance]
  const label = { high: "🟢 high", medium: "🟡 medium", inferred: "⚪ inferred" }[confiance]
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", cfg)}>
      {label}
    </span>
  )
}

function KindBadge({ kind }: { kind: string }) {
  const cls = KIND_STYLES[kind] ?? "bg-slate-700/30 text-slate-400 border-slate-600/30"
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium mt-0.5 inline-block", cls)}>
      {kind}
    </span>
  )
}

function RelationDetailDialog({
  entry,
  onClose,
}: {
  entry: KBEntry | null
  onClose: () => void
}) {
  const refs: TrouveRef[] = entry?.trouve_dans ?? []
  return (
    <Dialog open={!!entry} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100 text-sm font-semibold">
            Relation sémantique
          </DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="flex flex-col gap-4 text-sm">
            {/* from → to */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-blue-300 font-semibold">{entry.relation_from}</span>
              <span className="text-slate-500">→</span>
              <span className="font-mono text-teal-300 font-semibold">{entry.relation_to}</span>
            </div>

            {/* kind + direction */}
            <div className="flex items-center gap-2 flex-wrap">
              {entry.relation_kind && <KindBadge kind={entry.relation_kind} />}
              {entry.relation_direction && (
                <span className="text-xs text-slate-500">{entry.relation_direction}</span>
              )}
              {entry.domaine && entry.domaine !== "—" && (
                <span className="text-xs text-slate-500">· {entry.domaine}</span>
              )}
            </div>

            {/* sémantique */}
            {entry.notes && (
              <p className="text-slate-400 text-xs leading-relaxed">{entry.notes}</p>
            )}

            {/* trouvé dans */}
            {refs.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1.5">
                  Trouvé dans
                </p>
                <ul className="flex flex-col gap-1">
                  {refs.map((ref, i) => (
                    <li key={i} className="text-xs font-mono text-slate-300 bg-slate-800 rounded px-2 py-1">
                      <span className="text-slate-400">{ref.fichier}</span>
                      {ref.methode && (
                        <span className="text-blue-400"> ::{ref.methode}</span>
                      )}
                      {ref.ligne != null && (
                        <span className="text-slate-500"> :{ref.ligne}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {refs.length === 0 && (
              <p className="text-xs text-slate-600 italic">Aucune référence de code disponible.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type SortKey = "code" | "domaine" | "confiance" | "pending_questions"

export function KBEntriesTable({ onEdit }: KBEntriesTableProps) {
  const [search, setSearch]               = useState("")
  const [sortKey, setSortKey]             = useState<SortKey>("confiance")
  const [sortAsc, setSortAsc]             = useState(true)
  const [filterConfiance, setFilterConfiance] = useState<string>("all")
  const [filterType, setFilterType]       = useState<string>("all")
  const [selectedRelation, setSelectedRelation] = useState<KBEntry | null>(null)

  const { data: entries, isLoading } = useQuery({
    queryKey: ["kb-entries"],
    queryFn: getKBEntries,
    staleTime: 30_000,
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = (entries ?? [])
    .filter(e => {
      if (filterConfiance !== "all" && e.confiance !== filterConfiance) return false
      if (filterType !== "all" && e.section !== filterType) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.code.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.domaine.toLowerCase().includes(q) ||
        (e.relation_from ?? "").toLowerCase().includes(q) ||
        (e.relation_to ?? "").toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const order = { high: 0, medium: 1, inferred: 2 }
      let cmp = 0
      if (sortKey === "confiance") cmp = (order[a.confiance] ?? 3) - (order[b.confiance] ?? 3)
      else if (sortKey === "pending_questions") cmp = a.pending_questions - b.pending_questions
      else cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "")
      return sortAsc ? cmp : -cmp
    })

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-slate-700">↕</span>
    return sortAsc
      ? <ChevronUp className="h-3 w-3 inline-block" />
      : <ChevronDown className="h-3 w-3 inline-block" />
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        onClick={() => toggleSort(k)}
        className="px-3 py-2 text-left text-xs text-slate-400 font-medium uppercase tracking-wide cursor-pointer hover:text-slate-200 select-none whitespace-nowrap"
      >
        {label} <SortIcon k={k} />
      </th>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barre de recherche + filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher code, label, domaine…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-800 pl-8 pr-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* Filtre confiance */}
        <div className="flex items-center gap-1">
          {(["all", "high", "medium", "inferred"] as const).map(v => (
            <button
              key={v}
              onClick={() => setFilterConfiance(v)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors border",
                filterConfiance === v
                  ? "bg-slate-700 text-slate-100 border-slate-600"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              )}
            >
              {v === "all" ? "Tous" : v}
            </button>
          ))}
        </div>

        {/* Filtre type */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
        >
          {TYPE_FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span className="text-xs text-slate-600 tabular-nums">
          {filtered.length}/{entries?.length ?? 0} entrées
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-800/70 border-b border-slate-700">
                <Th label="Code" k="code" />
                <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium uppercase tracking-wide whitespace-nowrap">
                  Type
                </th>
                <Th label="Domaine" k="domaine" />
                <Th label="Confiance" k="confiance" />
                <Th label="Questions" k="pending_questions" />
                <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Label
                </th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="h-3 rounded bg-slate-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-600 text-xs">
                    {search || filterConfiance !== "all" || filterType !== "all"
                      ? "Aucun résultat"
                      : "KB vide"}
                  </td>
                </tr>
              ) : (
                filtered.map(entry => {
                  const isRelation = entry.section === "relations"
                  return (
                    <tr
                      key={`${entry.section}::${entry.code}`}
                      className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => isRelation ? setSelectedRelation(entry) : onEdit(entry)}
                    >
                      {/* Code */}
                      <td className="px-3 py-2.5">
                        {isRelation ? (
                          <span className="font-mono text-xs text-slate-200">
                            <span className="text-blue-300 font-semibold">{entry.relation_from}</span>
                            <span className="text-slate-500 mx-1">→</span>
                            <span className="text-teal-300 font-semibold">{entry.relation_to}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-200 font-semibold">
                            {entry.code}
                          </span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className={cn(
                            "text-xs",
                            isRelation ? "text-blue-400 font-medium" : "text-slate-500"
                          )}>
                            {SECTION_LABELS[entry.section] ?? entry.section}
                          </span>
                          {isRelation && entry.relation_kind && (
                            <KindBadge kind={entry.relation_kind} />
                          )}
                        </div>
                      </td>

                      {/* Domaine */}
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        {entry.domaine}
                      </td>

                      {/* Confiance */}
                      <td className="px-3 py-2.5">
                        <ConfidenceBadge confiance={entry.confiance} />
                      </td>

                      {/* Questions PO */}
                      <td className="px-3 py-2.5 text-center">
                        {!isRelation && entry.pending_questions > 0 ? (
                          <span className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-medium">
                            {entry.pending_questions} ❓
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>

                      {/* Label */}
                      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-48 truncate">
                        {isRelation
                          ? (entry.notes || entry.label)
                          : entry.label}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => isRelation ? setSelectedRelation(entry) : onEdit(entry)}
                          className={cn(
                            "text-xs hover:underline transition-colors whitespace-nowrap",
                            isRelation
                              ? "text-blue-400 hover:text-blue-300"
                              : "text-blue-400 hover:text-blue-300"
                          )}
                        >
                          {isRelation ? "Détail →" : "Enrichir →"}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog détail relation */}
      <RelationDetailDialog
        entry={selectedRelation}
        onClose={() => setSelectedRelation(null)}
      />
    </div>
  )
}
