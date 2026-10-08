import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { fonts } from "@/app/fonts"

import "./globals.css"

const fontVariables = Object.values(fonts)
  .map((font) => font.variable)
  .join(" ")

export const metadata: Metadata = {
  title: { default: "VYRA Studio", template: "%s · VYRA Studio" },
  description: "Générer les expériences 3D des clubs, en local.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: "#060408" }

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`dark ${fontVariables} h-full antialiased`}>
      <body className="bg-ink text-label min-h-full">{children}</body>
    </html>
  )
}
