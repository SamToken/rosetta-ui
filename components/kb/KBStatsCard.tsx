import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { KBStats } from "@/lib/types"

interface KBStatsCardProps {
  stats: KBStats
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-200 tabular-nums">{value}</span>
    </div>
  )
}

export function KBStatsCard({ stats }: KBStatsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Inventaire */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">Inventaire KB</CardTitle>
        </CardHeader>
        <CardContent>
          <StatRow label="Codes métier"   value={stats.codes} />
          <StatRow label="Règles métier"  value={stats.regles_metier ?? 0} />
          <StatRow label="Bugs connus"    value={stats.bugs_connus   ?? 0} />
          <StatRow label="Observations"   value={stats.observations  ?? 0} />
          {(stats.regles ?? 0) > 0 && (
            <StatRow label="Règles (non migrées)" value={stats.regles} />
          )}
          <StatRow label="Colonnes Oracle" value={stats.colonnes} />
          <StatRow label="Vues Oracle" value={stats.vues} />
          <StatRow label="Requêtes" value={stats.requetes} />
          <StatRow label="Relations" value={stats.relations ?? 0} />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">Total</span>
            <span className="text-lg font-bold text-white tabular-nums">{stats.total}</span>
          </div>
        </CardContent>
      </Card>

      {/* Confiance */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-slate-300">Confiance</CardTitle>
            {(stats.pending_po ?? 0) > 0 && (
              <Badge className="bg-red-900 text-red-200 border-red-700 border text-xs">
                {stats.pending_po} à valider PO
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <ConfidenceBar label="High" value={stats.high} total={stats.total} color="bg-green-500" />
            <ConfidenceBar label="Medium" value={stats.medium} total={stats.total} color="bg-yellow-500" />
            <ConfidenceBar label="Inferred" value={stats.inferred} total={stats.total} color="bg-slate-500" />
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Projet : {stats.projet} v{stats.version} · Maintenu par {stats.maintainer}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ConfidenceBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs text-slate-400 text-right">{label}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-xs text-slate-300 tabular-nums text-right">{value}</span>
    </div>
  )
}
