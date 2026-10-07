import { describe, expect, it } from "vitest"

import { nahoContent } from "@/content/clubs/naho"
import type { VenueContent } from "@/lib/schema"
import { pricePerPerson, tierRank, zoneSummary } from "@/lib/venue/offers"

describe("pricePerPerson", () => {
  it("splits the minimum spend over a full table, rounded up", () => {
    expect(pricePerPerson({ minimumSpend: 350, capacity: { min: 4, max: 6 } })).toBe(59)
    expect(pricePerPerson({ minimumSpend: 1000, capacity: { min: 6, max: 8 } })).toBe(125)
  })

  it("is null when the price is on request", () => {
    expect(pricePerPerson({ minimumSpend: null, capacity: { min: 4, max: 6 } })).toBeNull()
  })
})

describe("zoneSummary", () => {
  it("ignores sold tables in the 'from' prices", () => {
    // l2 (350 €) is sold, l1 (350 €) is not.
    expect(zoneSummary(nahoContent, "lounge-vegetal")).toEqual({
      fromMinimum: 350,
      fromPerPerson: 59,
      available: 4,
      total: 5,
    })
    // v5 (750 €) is sold; the cheapest open tables are v6 / v7 at 700 €.
    expect(zoneSummary(nahoContent, "vip-est")).toEqual({
      fromMinimum: 700,
      fromPerPerson: 88,
      available: 3,
      total: 4,
    })
  })

  it("counts tables on request as still open", () => {
    expect(zoneSummary(nahoContent, "prestige-dj")).toEqual({
      fromMinimum: 2500,
      fromPerPerson: 167,
      available: 1,
      total: 1,
    })
  })

  it("has no 'from' price when every table is sold", () => {
    const soldOut: VenueContent = {
      ...nahoContent,
      tables: nahoContent.tables.map((table) => ({ ...table, status: "sold" })),
    }
    expect(zoneSummary(soldOut, "vip-balcon")).toEqual({
      fromMinimum: null,
      fromPerPerson: null,
      available: 0,
      total: 3,
    })
  })

  it("is empty for an unknown zone", () => {
    expect(zoneSummary(nahoContent, "nowhere")).toEqual({
      fromMinimum: null,
      fromPerPerson: null,
      available: 0,
      total: 0,
    })
  })
})

describe("tierRank", () => {
  it("orders tiers from lounge to prestige", () => {
    expect(tierRank("lounge")).toBeLessThan(tierRank("vip"))
    expect(tierRank("vip")).toBeLessThan(tierRank("prestige"))
  })
})
