import type {
  AuditStartRequest,
  CaptureRequest,
  CaptureResponse,
  Job,
  JobCreatedResponse,
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

export async function getROI(): Promise<ROISummary> {
  return apiFetch<ROISummary>("/audit/roi")
}

// ── KB ─────────────────────────────────────────────────────────────────────

export async function getKBStats(): Promise<KBStats> {
  return apiFetch<KBStats>("/kb/stats")
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
