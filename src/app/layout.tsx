import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Unbounded } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
})

export const metadata: Metadata = {
  title: { default: "VYRA — visites 3D de clubs", template: "%s · VYRA" },
  description: "Visitez le club en 3D, comparez les tables et envoyez votre demande au club.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#0b0810",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
