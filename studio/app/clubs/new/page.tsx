import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { NewClubForm } from "@studio/components/new-club-form"
import { Panel } from "@studio/components/ui"

export const metadata = { title: "Nouveau club" }

export default function NewClubPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-10 pb-24">
      <Link
        href="/"
        className="text-footnote text-label-2 hover:text-label inline-flex items-center gap-1"
      >
        <ChevronLeft className="size-4" /> Clubs
      </Link>
      <p className="eyebrow text-brand mt-8">Nouveau club</p>
      <h1 className="text-display text-label mt-3">Ce qu&apos;on sait du lieu</h1>
      <p className="text-callout text-label-2 mt-2">
        Les photos et plans restent sur cette machine (
        <code className="font-code">clubs/&lt;club&gt;/private/</code>, jamais versionnés : le dépôt
        est public). Tout le reste — brief, notes, rendus, captures, retours — est versionné avec le
        club. La démo générée restera une démo jusqu&apos;à l&apos;accord écrit du club.
      </p>
      <Panel className="mt-8 p-6 sm:p-8">
        <NewClubForm />
      </Panel>
    </main>
  )
}
