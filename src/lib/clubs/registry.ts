import { clubs } from "@clubs/registry"
import type { ClubDefinition } from "@/lib/clubs/club"
import type { VenueContent } from "@/lib/schema"

/*
 * Server-side access to the registered clubs (`clubs/registry.ts`). Client components get the
 * one club they show from the venue page: importing this module would bundle every club.
 */

const bySlug = new Map<string, ClubDefinition>()
for (const club of clubs) {
  if (bySlug.has(club.slug)) {
    throw new Error(`Club "${club.slug}" is registered twice in clubs/registry.ts`)
  }
  bySlug.set(club.slug, club)
}

export function listClubs(): readonly ClubDefinition[] {
  return clubs
}

export function getClub(slug: string): ClubDefinition | null {
  return bySlug.get(slug) ?? null
}

/** The night on sale at a club, if the event slug matches. */
export function getVenueContent(club: string, event: string): VenueContent | null {
  const content = getClub(club)?.content
  return content && content.event.slug === event ? content : null
}

/** Route params of every venue night, for `generateStaticParams`. */
export function listVenues(): { club: string; event: string }[] {
  return clubs.map((club) => ({ club: club.slug, event: club.content.event.slug }))
}
