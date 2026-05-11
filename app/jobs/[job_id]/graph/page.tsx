"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  MarkerType,
} from "reactflow"
import "reactflow/dist/style.css"
import { ArrowLeft, X } from "lucide-react"
import { getJobDependencies } from "@/lib/api"
import type { DepNode } from "@/lib/types"

// ── Colonnes LR : Controller → Service → Inconnu ────────────────────────────

const TYPE_ORDER = ["controller", "service", "unknown"] as const
type FileType = typeof TYPE_ORDER[number]

const COL_X: Record<FileType, number> = {
  controller: 0,
  service:    700,
  unknown:    1400,
}

const COL_LABEL: Record<FileType, string> = {
  controller: "Controller",
  service:    "Service",
  unknown:    "Inconnu",
}

const TYPE_COLOR: Record<FileType, { bg: string; border: string; text: string }> = {
  controller: { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd" },
  service:    { bg: "#2d1b69", border: "#8b5cf6", text: "#c4b5fd" },
  unknown:    { bg: "#1e293b", border: "#475569", text: "#94a3b8" },
}

const COL_HEADER_COLOR: Record<FileType, string> = {
  controller: "#3b82f6",
  service:    "#8b5cf6",
  unknown:    "#475569",
}

const Y_STEP = 100

function buildLayout(depNodes: DepNode[]): Node[] {
  const colCounters: Record<string, number> = { controller: 0, service: 0, unknown: 0 }

  return depNodes.map((n) => {
    const col = (n.file_type in COL_X ? n.file_type : "unknown") as FileType
    const row = colCounters[col]++
    const colors = TYPE_COLOR[col]
    return {
      id: n.id,
      position: { x: COL_X[col], y: row * Y_STEP + 20 },
      data: {
        label: n.label,
        flags: n.flags,
        file_type: n.file_type,
        confidence: n.confidence,
        file_path: n.file_path,
      },
      style: {
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: "6px",
        color: colors.text,
        fontSize: "12px",
        fontFamily: "JetBrains Mono, monospace",
        padding: "6px 12px",
        minWidth: "170px",
        maxWidth: "240px",
        cursor: "pointer",
      },
    }
  })
}

// ── Panel latéral détail ──────────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: DepNode; onClose: () => void }) {
  const col = (node.file_type in TYPE_COLOR ? node.file_type : "unknown") as FileType
  const colors = TYPE_COLOR[col]
  const confPct = Math.round(node.confidence * 100)

  return (
    <div className="absolute top-4 right-4 z-10 w-72 rounded-lg border border-slate-700 bg-slate-900 shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span
          className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {COL_LABEL[col]}
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p className="font-mono text-sm font-semibold text-slate-100 break-all">{node.label}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-slate-500 uppercase tracking-wide">Flags</span>
            <span className={`font-semibold ${node.flags > 15 ? "text-red-400" : node.flags > 5 ? "text-orange-400" : "text-green-400"}`}>
              {node.flags}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-slate-500 uppercase tracking-wide">Confiance</span>
            <span className={`font-semibold ${confPct >= 70 ? "text-green-400" : confPct >= 40 ? "text-yellow-400" : "text-red-400"}`}>
              {confPct}%
            </span>
          </div>
        </div>
        {node.file_path && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Fichier source</span>
            <span className="text-xs text-slate-400 font-mono break-all leading-relaxed">
              {node.file_path.split("/").slice(-3).join("/")}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function GraphPage() {
  const params = useParams<{ job_id: string }>()
  const router = useRouter()
  const jobId = params.job_id

  const { data, isLoading, isError } = useQuery({
    queryKey: ["job-deps", jobId],
    queryFn: () => getJobDependencies(jobId),
    staleTime: 60_000,
  })

  // ── Degré de chaque nœud (in + out) ────────────────────────────────────────
  const nodeDegree = useMemo<Record<string, number>>(() => {
    const deg: Record<string, number> = {}
    for (const n of data?.nodes ?? []) deg[n.id] = 0
    for (const e of data?.edges ?? []) {
      deg[e.source] = (deg[e.source] ?? 0) + 1
      deg[e.target] = (deg[e.target] ?? 0) + 1
    }
    return deg
  }, [data])

  const maxDegree = useMemo(
    () => Math.max(0, ...Object.values(nodeDegree)),
    [nodeDegree]
  )

  // ── Filtres ─────────────────────────────────────────────────────────────────
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [minConn, setMinConn] = useState(0)

  function toggleType(t: string) {
    setHiddenTypes(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  // Compte par type (tous nœuds, avant filtres)
  const countByType = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = { controller: 0, service: 0, unknown: 0 }
    for (const n of data?.nodes ?? []) {
      const t = n.file_type in c ? n.file_type : "unknown"
      c[t]++
    }
    return c
  }, [data])

  // Nœuds visibles après filtres
  const visibleIds = useMemo(() => {
    return new Set(
      (data?.nodes ?? [])
        .filter(n => !hiddenTypes.has(n.file_type in TYPE_COLOR ? n.file_type : "unknown"))
        .filter(n => (nodeDegree[n.id] ?? 0) >= minConn)
        .map(n => n.id)
    )
  }, [data, hiddenTypes, minConn, nodeDegree])

  // ── Layout + arêtes ─────────────────────────────────────────────────────────
  const allNodes = useMemo(
    () => (data ? buildLayout(data.nodes) : []),
    [data]
  )

  const allEdges: Edge[] = useMemo(() => {
    const EDGE_COLOR: Record<string, string> = {
      service:       "#60a5fa",
      instantiation: "#fb923c",
      use:           "#94a3b8",
    }
    return (data?.edges ?? []).map((e, i) => {
      const color = EDGE_COLOR[e.dep_type] ?? EDGE_COLOR.use
      return {
        id: `e${i}`,
        source: e.source,
        target: e.target,
        label: e.dep_type !== "use" ? e.dep_type : undefined,
        labelStyle: { fontSize: 9, fill: color, fontFamily: "JetBrains Mono, monospace" },
        labelBgStyle: { fill: "#0f172a", fillOpacity: 0.85 },
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        animated: e.dep_type === "service",
      }
    })
  }, [data])

  // Appliquer les filtres
  const filteredNodes = useMemo(
    () => allNodes.filter(n => visibleIds.has(n.id)),
    [allNodes, visibleIds]
  )

  const filteredEdges = useMemo(
    () => allEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [allEdges, visibleIds]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(filteredNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges)
  const [selected, setSelected] = useState<DepNode | null>(null)

  useEffect(() => { setNodes(filteredNodes) }, [filteredNodes, setNodes])
  useEffect(() => { setEdges(filteredEdges) }, [filteredEdges, setEdges])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      setSelected(data?.nodes.find(n => n.id === node.id) ?? null)
    },
    [data]
  )

  const totalNodes = data?.nodes.length ?? 0

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-950 shrink-0 flex-wrap gap-y-2">
        <button
          onClick={() => router.push(`/jobs/${jobId}`)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-slate-400">
          Graphe de dépendances —{" "}
          <span className="font-mono text-slate-300 text-xs">{jobId.slice(0, 8)}…</span>
        </span>

        {/* ── Filtres type ─────────────────────────────────────────────── */}
        {data && (
          <div className="flex items-center gap-1.5 ml-4">
            {TYPE_ORDER.map(t => {
              const active = !hiddenTypes.has(t)
              const colors = TYPE_COLOR[t]
              const count = countByType[t] ?? 0
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  title={active ? `Masquer les ${COL_LABEL[t]}s` : `Afficher les ${COL_LABEL[t]}s`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all border"
                  style={
                    active
                      ? { background: colors.bg, borderColor: colors.border, color: colors.text }
                      : { background: "transparent", borderColor: "#334155", color: "#475569" }
                  }
                >
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ background: active ? colors.border : "#334155" }}
                  />
                  {COL_LABEL[t]}
                  <span className="opacity-60">({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Slider connexions min ─────────────────────────────────────── */}
        {data && maxDegree > 0 && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-slate-500 whitespace-nowrap">Connexions min</span>
            <input
              type="range"
              min={0}
              max={maxDegree}
              value={minConn}
              onChange={e => setMinConn(Number(e.target.value))}
              className="w-24 accent-blue-500"
            />
            <span className="text-xs font-mono text-blue-400 w-4 text-center">{minConn}</span>
          </div>
        )}

        {/* ── Stats ────────────────────────────────────────────────────── */}
        {data && (
          <span className="ml-auto text-xs text-slate-600 tabular-nums">
            {visibleIds.size}<span className="text-slate-700">/{totalNodes}</span> nœuds
            · {filteredEdges.length}<span className="text-slate-700">/{data.edges.length}</span> arêtes
          </span>
        )}
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-slate-950">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
            Chargement du graphe…
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
            Impossible de charger les dépendances.
          </div>
        )}
        {!isLoading && !isError && data && totalNodes === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm">
            Aucun fichier analysé dans ce job.
          </div>
        )}
        {!isLoading && !isError && data && totalNodes > 0 && visibleIds.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-slate-500 text-sm">
            <span>Aucun nœud visible avec ces filtres.</span>
            <button
              onClick={() => { setHiddenTypes(new Set()); setMinConn(0) }}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {data && visibleIds.size > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.08}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={24} size={1} />
            <Controls
              style={{ background: "#0f172a", border: "1px solid #1e293b" }}
              showInteractive={false}
            />
            <MiniMap
              nodeColor={n => {
                const t = (n.data as { file_type: string }).file_type as FileType
                return TYPE_COLOR[t]?.border ?? "#475569"
              }}
              style={{ background: "#0f172a", border: "1px solid #1e293b" }}
              maskColor="rgba(15,23,42,0.7)"
            />
          </ReactFlow>
        )}

        {/* ── Légende colonnes ─────────────────────────────────────────── */}
        {data && visibleIds.size > 0 && (
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-900/90 px-3 py-2 backdrop-blur-sm">
            <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-0.5">Clusters (gauche → droite)</p>
            {TYPE_ORDER.map(t => (
              <div key={t} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{ background: TYPE_COLOR[t].bg, borderColor: TYPE_COLOR[t].border }}
                />
                <span className="text-xs" style={{ color: COL_HEADER_COLOR[t] }}>{COL_LABEL[t]}</span>
              </div>
            ))}
            <div className="mt-1 border-t border-slate-800 pt-1.5 flex flex-col gap-0.5 text-[10px] text-slate-600">
              <span>— Arête animée = injection service</span>
              <span>— Arête orange = instanciation</span>
            </div>
          </div>
        )}

        {/* ── Panel détail nœud ────────────────────────────────────────── */}
        {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
