import type { Metadata, Viewport } from "next"

import { fonts } from "./fonts"
import "./globals.css"

const fontVariables = Object.values(fonts)
  .map((font) => font.variable)
  .join(" ")

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
  // the on-screen keyboard shrinks the page, so the request form stays above it
  interactiveWidget: "resizes-content",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`dark ${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
