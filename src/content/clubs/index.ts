import { nahoContent } from "@/content/clubs/naho"
import type { VenueContent } from "@/lib/schema"

/** Every published venue night. Each content module is validated when it loads. */
const venues: readonly VenueContent[] = [nahoContent]

export function getVenueContent(club: string, event: string): VenueContent | null {
  return venues.find((venue) => venue.club.slug === club && venue.event.slug === event) ?? null
}

/** Route params of every venue night, for `generateStaticParams`. */
export function listVenues(): { club: string; event: string }[] {
  return venues.map((venue) => ({ club: venue.club.slug, event: venue.event.slug }))
}
