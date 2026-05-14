import type {
  AuditStartRequest,
  CaptureRequest,
  CaptureResponse,
  DependencyGraph,
  FlagOut,
  ImpactIndex,
  ImpactToken,
  Job,
  JobCreatedResponse,
  KBEntry,
  KBStats,
  OutputFile,
  PendingItem,
  ROISummary,
  ValidatePendingRequest,
  ValidatePendingResponse,
} from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8765"

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body?.detail ?? message
    } catch {
      // réponse non-JSON, on garde le message HTTP
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T
  }
  return res.json() as Promise<T>
}

// ── Audit ──────────────────────────────────────────────────────────────────

export async function getJobs(): Promise<Job[]> {
  return apiFetch<Job[]>("/audit/")
}

export async function getJob(jobId: string): Promise<Job> {
  return apiFetch<Job>(`/audit/${jobId}`)
}

export async function startAudit(
  request: AuditStartRequest,
): Promise<JobCreatedResponse> {
  return apiFetch<JobCreatedResponse>("/audit/start", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

export async function getROI(linesPerHour?: number, hourlyRate?: number): Promise<ROISummary> {
  const params = new URLSearchParams()
  if (linesPerHour !== undefined) params.set("lines_per_hour", String(linesPerHour))
  if (hourlyRate !== undefined) params.set("hourly_rate", String(hourlyRate))
  const qs = params.size > 0 ? `?${params}` : ""
  return apiFetch<ROISummary>(`/audit/roi${qs}`)
}

// ── KB ─────────────────────────────────────────────────────────────────────

export async function getKBStats(): Promise<KBStats> {
  return apiFetch<KBStats>("/kb/stats")
}

export async function getKBDomains(): Promise<string[]> {
  return apiFetch<string[]>("/kb/domains")
}

export async function getKBEntries(): Promise<KBEntry[]> {
  return apiFetch<KBEntry[]>("/kb/entries")
}

export async function deleteKBEntry(code: string, section: string): Promise<void> {
  await apiFetch<unknown>(`/kb/${encodeURIComponent(code)}?section=${encodeURIComponent(section)}`, {
    method: "DELETE",
  })
}

export async function getKBPending(): Promise<PendingItem[]> {
  return apiFetch<PendingItem[]>("/kb/pending")
}

export async function captureCode(
  request: CaptureRequest,
): Promise<CaptureResponse> {
  return apiFetch<CaptureResponse>("/kb/capture", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

export async function validatePending(
  pendingId: string,
  payload: ValidatePendingRequest,
): Promise<ValidatePendingResponse> {
  return apiFetch<ValidatePendingResponse>(`/kb/validate/${pendingId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getJobDependencies(jobId: string): Promise<DependencyGraph> {
  return apiFetch<DependencyGraph>(`/audit/${jobId}/dependencies`)
}

export async function deleteJob(jobId: string): Promise<void> {
  await apiFetch<void>(`/audit/${jobId}`, { method: "DELETE" })
}

// ── Impact cross-fichier ───────────────────────────────────────────────────

export async function getImpactTokens(params?: {
  search?: string
  minOccurrences?: number
  maxTokens?: number
}): Promise<ImpactIndex> {
  const p = new URLSearchParams()
  if (params?.search)          p.set("search", params.search)
  if (params?.minOccurrences)  p.set("min_occurrences", String(params.minOccurrences))
  if (params?.maxTokens)       p.set("max_tokens", String(params.maxTokens))
  const qs = p.size > 0 ? `?${p}` : ""
  return apiFetch<ImpactIndex>(`/impact/tokens${qs}`)
}

export async function getImpactToken(token: string): Promise<ImpactToken> {
  return apiFetch<ImpactToken>(`/impact/tokens/${encodeURIComponent(token)}`)
}

// ── Job outputs ─────────────────────────────────────────────────────────────

export async function getJobFiles(jobId: string): Promise<OutputFile[]> {
  return apiFetch<OutputFile[]>(`/audit/${jobId}/files`)
}

export async function getJobFile(jobId: string, path: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/audit/${jobId}/file?path=${encodeURIComponent(path)}`,
  )
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.text()
}

export async function getJobFlags(jobId: string): Promise<FlagOut[]> {
  return apiFetch<FlagOut[]>(`/audit/${jobId}/flags`)
}

export async function exportJobHuman(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/audit/${jobId}/export/human`)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  const text = await res.text()
  const cd = res.headers.get("Content-Disposition") ?? ""
  const match = cd.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? `fusion_kb_${jobId.slice(0, 8)}.md`
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
