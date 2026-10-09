import { z } from "zod"

import { ambianceSchema, type ClubAmbiance } from "@/lib/clubs/ambiance"
import { assetManifestSchema, type AssetManifest } from "@/lib/clubs/assets"
import { brandSchema, type ClubBrand } from "@/lib/clubs/brand"
import { venueContentSchema, type VenueContent } from "@/lib/schema"
import { venueLayoutSchema, type VenueLayout } from "@/lib/venue/layout"

/**
 * Everything the app knows about one club, read from its folder `clubs/<slug>/` (docs/clubs.md).
 * Plain JSON: the venue page hands it to the client as is.
 */
export interface ClubDefinition {
  slug: string
  /** The night on sale: zones, tables, prices, conditions (`content.json`). */
  content: VenueContent
  /** Plan shared with the Blender build (`layout.json`). */
  layout: VenueLayout
  /** Accent, tier hues, typeface, wordmark and emblem in the interface (`brand.json`). */
  brand: ClubBrand
  /** Light show, FX colours, reflections and material finishes (`ambiance.json`). */
  ambiance: ClubAmbiance
  /** Web bundle: model and lightmaps with their content hashes (`public/lightmaps.json`). */
  assets: AssetManifest
}

/** Files of a club folder, before validation. */
export type ClubFiles = { [K in Exclude<keyof ClubDefinition, "slug">]: unknown }

/**
 * Validates a club folder. Throws one report listing every problem, so a broken club fails the
 * build and the tests instead of rendering half a venue.
 */
export function defineClub(files: ClubFiles): ClubDefinition {
  const problems: string[] = []
  function parse<T>(file: string, schema: z.ZodType<T>, value: unknown): T | null {
    const result = schema.safeParse(value)
    if (result.success) return result.data
    problems.push(`${file}\n${z.prettifyError(result.error)}`)
    return null
  }
  const content = parse("content.json", venueContentSchema, files.content)
  const layout = parse("layout.json", venueLayoutSchema, files.layout)
  const brand = parse("brand.json", brandSchema, files.brand)
  const ambiance = parse("ambiance.json", ambianceSchema, files.ambiance)
  const assets = parse("public/lightmaps.json", assetManifestSchema, files.assets)
  if (content && layout && assets) problems.push(...crossCheck({ content, layout, assets }))
  if (!content || !layout || !brand || !ambiance || !assets || problems.length > 0) {
    const slug = content?.club.slug ?? layout?.club ?? "?"
    throw new Error(`Invalid club "${slug}" (clubs/${slug}/):\n${problems.join("\n")}`)
  }
  return { slug: content.club.slug, content, layout, brand, ambiance, assets }
}

/** The content, the plan and the bundle must describe the same venue, zone for zone. */
export function crossCheck({
  content,
  layout,
  assets,
}: Pick<ClubDefinition, "content" | "layout" | "assets">): string[] {
  const problems: string[] = []
  const slug = content.club.slug
  if (layout.club !== slug) problems.push(`layout.json: club "${layout.club}", expected "${slug}"`)
  if (assets.club !== slug) {
    problems.push(`public/lightmaps.json: club "${assets.club}", expected "${slug}"`)
  }

  const plannedZones = new Map(layout.zones.map((zone) => [zone.id, zone]))
  for (const zone of content.zones) {
    const planned = plannedZones.get(zone.id)
    if (!planned) problems.push(`content.json: zone "${zone.id}" is not in layout.json`)
    else if (planned.tier !== zone.tier) {
      problems.push(
        `content.json: zone "${zone.id}" is ${zone.tier}, layout.json says ${planned.tier}`,
      )
    }
  }
  const describedZones = new Set(content.zones.map((zone) => zone.id))
  for (const zone of layout.zones) {
    if (!describedZones.has(zone.id)) problems.push(`layout.json: zone "${zone.id}" has no content`)
  }

  const plannedTables = new Map(layout.tables.map((table) => [table.id, table]))
  for (const table of content.tables) {
    const planned = plannedTables.get(table.id)
    if (!planned) problems.push(`content.json: table "${table.id}" is not in layout.json`)
    else if (planned.zone !== table.zoneId) {
      problems.push(
        `content.json: table "${table.id}" is in zone "${table.zoneId}", layout.json says "${planned.zone}"`,
      )
    }
  }
  const areas = new Set((layout.standing ?? []).map((area) => area.id))
  for (const ticket of content.tickets ?? []) {
    if (!areas.has(ticket.id)) {
      problems.push(`content.json: ticket "${ticket.id}" has no standing area in layout.json`)
    }
  }
  const sold = new Set((content.tickets ?? []).map((ticket) => ticket.id))
  for (const area of layout.standing ?? []) {
    if (!sold.has(area.id)) problems.push(`layout.json: standing area "${area.id}" has no ticket`)
  }

  const describedTables = new Set(content.tables.map((table) => table.id))
  for (const table of layout.tables) {
    if (!describedTables.has(table.id)) {
      problems.push(`layout.json: table "${table.id}" has no content`)
    }
  }
  return problems
}
