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

// ── Layout: colonnes par file_type ──────────────────────────────────────────

const TYPE_X: Record<string, number> = {
  controller: 0,
  service: 380,
  unknown: 760,
}

const TYPE_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  controller: { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd" },
  service:    { bg: "#2d1b69", border: "#8b5cf6", text: "#c4b5fd" },
  unknown:    { bg: "#1e293b", border: "#475569", text: "#94a3b8" },
}

function buildLayout(
  depNodes: DepNode[],
): { rfNodes: Node[]; rfEdges: Edge[] } {
  const colCounters: Record<string, number> = { controller: 0, service: 0, unknown: 0 }

  const rfNodes: Node[] = depNodes.map((n) => {
    const col = n.file_type in TYPE_X ? n.file_type : "unknown"
    const row = colCounters[col]++
    const colors = TYPE_COLOR[col] ?? TYPE_COLOR.unknown
    const flagSize = Math.min(Math.max(n.flags * 1.5, 0), 30) // badge width scaling
    return {
      id: n.id,
      position: { x: TYPE_X[col] ?? 760, y: row * 80 + 20 },
      data: {
        label: n.label,
        flags: n.flags,
        file_type: n.file_type,
        confidence: n.confidence,
        file_path: n.file_path,
        flagSize,
      },
      style: {
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: "6px",
        color: colors.text,
        fontSize: "12px",
        fontFamily: "JetBrains Mono, monospace",
        padding: "6px 12px",
        minWidth: "160px",
        maxWidth: "220px",
        cursor: "pointer",
      },
    }
  })

  return { rfNodes, rfEdges: [] }
}

// ── Panel latéral ────────────────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: DepNode; onClose: () => void }) {
  const colors = TYPE_COLOR[node.file_type] ?? TYPE_COLOR.unknown
  const confPct = Math.round(node.confidence * 100)

  return (
    <div className="absolute top-4 right-4 z-10 w-72 rounded-lg border border-slate-700 bg-slate-900 shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span
          className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {node.file_type}
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

// ── Page principale ──────────────────────────────────────────────────────────

export default function GraphPage() {
  const params = useParams<{ job_id: string }>()
  const router = useRouter()
  const jobId = params.job_id

  const { data, isLoading, isError } = useQuery({
    queryKey: ["job-deps", jobId],
    queryFn: () => getJobDependencies(jobId),
    staleTime: 60_000,
  })

  const { rfNodes: initialNodes } = useMemo(
    () => (data ? buildLayout(data.nodes) : { rfNodes: [], rfEdges: [] }),
    [data]
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      (data?.edges ?? []).map((e, i) => ({
        id: `e${i}`,
        source: e.source,
        target: e.target,
        label: e.dep_type !== "use" ? e.dep_type : undefined,
        labelStyle: { fontSize: 9, fill: "#64748b" },
        style: { stroke: "#334155", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#334155", width: 12, height: 12 },
        animated: e.dep_type === "service",
      })),
    [data]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(rfEdges)
  const [selected, setSelected] = useState<DepNode | null>(null)

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const depNode = data?.nodes.find((n) => n.id === node.id) ?? null
      setSelected(depNode)
    },
    [data]
  )

  const legendItems = [
    { label: "Controller", ...TYPE_COLOR.controller },
    { label: "Service", ...TYPE_COLOR.service },
    { label: "Inconnu", ...TYPE_COLOR.unknown },
  ]

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-950 shrink-0">
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
        {data && (
          <span className="text-xs text-slate-600 ml-auto tabular-nums">
            {data.nodes.length} nœuds · {data.edges.length} arêtes
          </span>
        )}
      </div>

      {/* Canvas */}
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
        {!isLoading && !isError && data && data.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm">
            Aucun fichier analysé dans ce job.
          </div>
        )}

        {data && data.nodes.length > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={24} size={1} />
            <Controls
              style={{ background: "#0f172a", border: "1px solid #1e293b" }}
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(n) => {
                const t = (n.data as { file_type: string }).file_type
                return TYPE_COLOR[t]?.border ?? "#475569"
              }}
              style={{ background: "#0f172a", border: "1px solid #1e293b" }}
              maskColor="rgba(15,23,42,0.7)"
            />
          </ReactFlow>
        )}

        {/* Légende */}
        {data && data.nodes.length > 0 && (
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-900/90 px-3 py-2 backdrop-blur-sm">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{ background: item.bg, borderColor: item.border }}
                />
                <span className="text-xs text-slate-400">{item.label}</span>
              </div>
            ))}
            <div className="mt-1 border-t border-slate-800 pt-1.5 text-xs text-slate-600 leading-tight">
              Arête animée = injection de service
            </div>
          </div>
        )}

        {/* Panel détail */}
        {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
