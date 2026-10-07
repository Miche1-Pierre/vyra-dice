import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { AnalyticsProvider } from "@/components/analytics/analytics-provider"
import { Experience } from "@/components/experience/experience"
import { getVenueContent, listVenues } from "@/content/clubs"

export function generateStaticParams() {
  return listVenues().map(({ club, event }) => ({ club, event }))
}

export async function generateMetadata({
  params,
}: PageProps<"/[club]/[event]">): Promise<Metadata> {
  const { club, event } = await params
  const content = getVenueContent(club, event)
  if (!content) return {}
  return {
    title: `${content.club.name} — ${content.event.name}`,
    description: `Visitez ${content.club.name} en 3D, comparez les tables et envoyez votre demande au club.`,
  }
}

/** Static shell shown while the route params resolve (instant navigation with Cache Components). */
function VenueShell() {
  return <div className="h-dvh w-full bg-[#060408]" aria-busy="true" />
}

async function Venue({ params }: Pick<PageProps<"/[club]/[event]">, "params">) {
  const { club, event } = await params
  const content = getVenueContent(club, event)
  if (!content) notFound()
  return (
    <>
      <AnalyticsProvider club={club} event={event} demo={content.club.demo} />
      <Experience clubSlug={club} eventSlug={event} content={content} />
    </>
  )
}

export default function VenuePage({ params }: PageProps<"/[club]/[event]">) {
  return (
    <Suspense fallback={<VenueShell />}>
      <Venue params={params} />
    </Suspense>
  )
}
