import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/shared/Navbar"
import { Providers } from "@/app/providers"
import { TooltipProvider } from "@/components/ui/tooltip"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Rosetta Cockpit",
  description: "Audit statique PHP — tableau de bord",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      {/*
        Dégradé radial : éclat bleu centré en haut → fond midnight vers slate-950.
        Donne de la profondeur sans alourdir la lisibilité.
      */}
      <body
        className="min-h-screen antialiased"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, hsl(217.2 91.2% 18%) 0%, hsl(222.2 84% 4.9%) 100%)",
          color: "hsl(210 40% 98%)",
        }}
      >
        <Providers>
          <TooltipProvider>
            <Navbar />
            <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
