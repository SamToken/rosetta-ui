export type JobStatus = "queued" | "running" | "success" | "error"
export type FileSummaryStatus = "no_llm" | "success" | "error"
export type Confidence = "high" | "medium" | "inferred"
export type Priority = "high" | "medium" | "low"

export type FileSummary = {
  filename: string
  file_size_lines: number
  processing_time_seconds: number
  flags_total: number
  flag_types: Record<string, number>
  insights_total: number
  llm_cost_usd: number
  status: FileSummaryStatus
}

export type AuditJobResult = {
  total_files: number
  total_insights: number
  total_cost_usd: number
  processing_time_seconds: number
  health_score: number
  output_dir: string
  php_paths: string[]
  files: FileSummary[]
}

export type Job = {
  job_id: string
  status: JobStatus
  created_at: string
  started_at: string | null
  finished_at: string | null
  result: AuditJobResult | null
  logs: string[]
  error: string | null
}

export type ROISummary = {
  total_runs: number
  total_lines_analyzed: number
  total_human_hours_saved: number
  financial_saving_eur: number
  total_llm_cost_usd: number
  total_machine_seconds: number
  success_rate_pct: number
  avg_processing_seconds: number
  lines_per_hour_constant: number
  hourly_rate_eur: number
}

export type KBStats = {
  projet: string
  version: string
  last_updated: string
  maintainer: string
  codes: number
  regles: number
  schema_entries: number
  colonnes: number
  vues: number
  requetes: number
  total: number
  high: number
  medium: number
  inferred: number
  pending_total: number
  pending_high: number
}

export type PendingItem = {
  id: string
  code: string
  question: string
  priorite: Priority
  domaine: string | null
  fichiers: string[]
  kb_type: string | null
  pending_type: number | null
  destination: string | null
}

export type CaptureRequest = {
  code: string
  label: string
  source: string
  confiance: "high" | "medium" | "inferred"
  domain: string
  champ?: string
  table?: string
  lie_a?: string
  notes?: string
  force?: boolean
}

export type CaptureResponse = {
  success: boolean
  code: string
  confiance: string
  domain: string
  action: string
  file_path: string | null
  message: string
}

export type ValidatePendingRequest = {
  label?: string
  source?: string
  notes?: string
  domaine?: string
}

export type ValidatePendingResponse = {
  success: boolean
  pending_id: string
  code: string
  action: string
  domain: string
  error: string | null
}

export type JobCreatedResponse = {
  job_id: string
  status: "queued"
  message: string
}

export type AuditStartRequest = {
  php_paths: string[]
  no_llm?: boolean
  model?: string
  bug_check?: boolean
  kb_root?: string
  call_graph_root?: string
  contexte?: string
  max_workers?: number
}
