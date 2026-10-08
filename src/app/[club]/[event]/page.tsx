import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { AnalyticsProvider } from "@/components/analytics/analytics-provider"
import { Experience } from "@/components/experience/experience"
import { brandCss } from "@/lib/clubs/brand"
import { getClub, getVenueContent, listVenues } from "@/lib/clubs/registry"

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
  const { club: slug, event } = await params
  const club = getClub(slug)
  if (!club || club.content.event.slug !== event) notFound()
  return (
    <>
      {/* the club's colours and typeface, on :root so portals (dialogs, menus) get them too */}
      <style>{brandCss(club.brand)}</style>
      <AnalyticsProvider club={slug} event={event} demo={club.content.club.demo} />
      <Experience club={club} />
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
