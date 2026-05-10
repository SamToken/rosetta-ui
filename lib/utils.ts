import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Job } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}min ${s}s`
}

export function formatCost(usd: number): string {
  if (usd === 0) return "gratuit"
  return `$${usd.toFixed(4)}`
}

export function formatLines(n: number): string {
  return n.toLocaleString("fr-FR")
}

export function truncate(str: string, max: number): string {
  return str.length <= max ? str : `…${str.slice(-(max - 1))}`
}

// ── Health score ───────────────────────────────────────────────────────────

export type HealthLevel = "high" | "medium" | "low"

export function healthLevel(score: number): HealthLevel {
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  return "low"
}

export function healthColor(score: number): string {
  const level = healthLevel(score)
  if (level === "high") return "text-green-500"
  if (level === "medium") return "text-orange-500"
  return "text-red-500"
}

// ── Heatmap ────────────────────────────────────────────────────────────────

export function flagsColor(flags: number): string {
  if (flags <= 10) return "#22c55e"
  if (flags <= 30) return "#eab308"
  if (flags <= 60) return "#f97316"
  if (flags <= 100) return "#ef4444"
  return "#991b1b"
}

// ── Polling helper ─────────────────────────────────────────────────────────

export function hasActiveJobs(jobs: Job[]): boolean {
  return jobs.some((j) => j.status === "queued" || j.status === "running")
}
