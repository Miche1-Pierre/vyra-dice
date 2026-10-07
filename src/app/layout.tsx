import type { Metadata, Viewport } from "next"
import { Jost } from "next/font/google"
import "./globals.css"

/** Geometric, airy, Futura-like: the voice of Naho's « C L U B » lettering, legible down to 11 px. */
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "VYRA — visites 3D de clubs", template: "%s · VYRA" },
  description: "Visitez le club en 3D, comparez les tables et envoyez votre demande au club.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#060408",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`dark ${jost.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
