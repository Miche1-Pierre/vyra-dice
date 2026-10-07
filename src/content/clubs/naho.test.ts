import { describe, expect, it } from "vitest"

import { getVenueContent, listVenues } from "@/content/clubs"
import { nahoContent } from "@/content/clubs/naho"
import { venueContentSchema, type Tier } from "@/lib/schema"
import { getLayout, type VenueLayout } from "@/lib/venue/layout"

function nahoLayout(): VenueLayout {
  const layout = getLayout("naho")
  if (!layout) throw new Error("naho layout missing")
  return layout
}

const sortedIds = (items: readonly { id: string }[]) => items.map((item) => item.id).sort()

describe("Naho content integrity", () => {
  const layout = nahoLayout()

  it("is valid venue content", () => {
    expect(venueContentSchema.safeParse(nahoContent).success).toBe(true)
  })

  it("has content for every layout table, and a layout table for every content table", () => {
    expect(sortedIds(nahoContent.tables)).toEqual(sortedIds(layout.tables))
  })

  it("puts every table in its layout zone", () => {
    const layoutZoneOf = new Map(layout.tables.map((table) => [table.id, table.zone]))
    for (const table of nahoContent.tables) {
      expect(table.zoneId, table.id).toBe(layoutZoneOf.get(table.id))
    }
  })

  it("describes every layout zone, with the layout tier", () => {
    expect(sortedIds(nahoContent.zones)).toEqual(sortedIds(layout.zones))
    const layoutTierOf = new Map(layout.zones.map((zone) => [zone.id, zone.tier]))
    for (const zone of nahoContent.zones) {
      expect(zone.tier, zone.id).toBe(layoutTierOf.get(zone.id))
    }
  })

  it("has consistent capacities", () => {
    for (const table of nahoContent.tables) {
      expect(table.capacity.min, table.id).toBeLessThanOrEqual(table.capacity.max)
    }
  })

  it("prices every prestige table above every VIP table, and every VIP above every lounge", () => {
    const tierOf = new Map(nahoContent.zones.map((zone) => [zone.id, zone.tier]))
    const spends = (tier: Tier) =>
      nahoContent.tables
        .filter((table) => tierOf.get(table.zoneId) === tier)
        .flatMap((table) => (table.minimumSpend === null ? [] : [table.minimumSpend]))
    const [lounge, vip, prestige] = [spends("lounge"), spends("vip"), spends("prestige")]
    expect(lounge.length && vip.length && prestige.length).toBeGreaterThan(0)
    expect(Math.min(...prestige)).toBeGreaterThan(Math.max(...vip))
    expect(Math.min(...vip)).toBeGreaterThan(Math.max(...lounge))
  })

  it("uses a three-letter request prefix", () => {
    expect(nahoContent.club.requestPrefix).toMatch(/^[A-Z]{3}$/)
  })

  it("labels tables with their uppercase id", () => {
    for (const table of nahoContent.tables) expect(table.label).toBe(table.id.toUpperCase())
  })

  it("is flagged as an unvalidated demo", () => {
    expect(nahoContent.club.demo).toBe(true)
    expect(nahoContent.club.disclaimer).toMatch(/^Démo/)
    expect(nahoContent.event.offersValidatedAt).toBeNull()
  })
})

describe("venue registry", () => {
  it("finds a venue night by club and event slug", () => {
    expect(getVenueContent("naho", "samedi")).toBe(nahoContent)
    expect(getVenueContent("naho", "dimanche")).toBeNull()
    expect(getVenueContent("autre", "samedi")).toBeNull()
  })

  it("lists every venue night, each with a layout", () => {
    const venues = listVenues()
    expect(venues).toContainEqual({ club: "naho", event: "samedi" })
    for (const { club } of venues) expect(getLayout(club), club).not.toBeNull()
  })
})
