"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, BookOpen, LayoutDashboard, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/jobs", label: "Jobs", icon: ListChecks },
  { href: "/roi", label: "ROI", icon: Activity },
  { href: "/kb", label: "KB", icon: BookOpen },
  { href: "/kb/pending", label: "Pending PO", icon: LayoutDashboard },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-white/5 bg-white/[0.03] backdrop-blur-md px-6 py-4 sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between">

        {/* Logo — même style que le dashboard de référence */}
        <Link href="/jobs" className="flex flex-col leading-tight">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Rosetta</span>
            {" "}
            <span className="text-blue-400">Cockpit</span>
          </span>
          <span className="text-xs font-normal text-slate-500 tracking-wide">
            Analyse statique PHP — tableau de bord
          </span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </div>

      </div>
    </nav>
  )
}
