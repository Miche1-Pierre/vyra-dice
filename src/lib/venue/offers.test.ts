import { describe, expect, it } from "vitest"

import type { VenueContent } from "@/lib/schema"
import { pricePerPerson, tierRank, zoneSummary } from "@/lib/venue/offers"
import { demoVenue } from "@/test/fixtures"

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
    // l2 (300 €) is sold, l1 (350 €) is not.
    expect(zoneSummary(demoVenue, "lounge")).toEqual({
      fromMinimum: 350,
      fromPerPerson: 59,
      available: 1,
      total: 2,
    })
  })

  it("counts tables on request as still open and skips unpriced ones", () => {
    // v1 (700 €) is on request, v2 has no price.
    expect(zoneSummary(demoVenue, "vip")).toEqual({
      fromMinimum: 700,
      fromPerPerson: 88,
      available: 2,
      total: 2,
    })
  })

  it("has no 'from' price when every table is sold", () => {
    const soldOut: VenueContent = {
      ...demoVenue,
      tables: demoVenue.tables.map((table) => ({ ...table, status: "sold" })),
    }
    expect(zoneSummary(soldOut, "vip")).toEqual({
      fromMinimum: null,
      fromPerPerson: null,
      available: 0,
      total: 2,
    })
  })

  it("is empty for an unknown zone", () => {
    expect(zoneSummary(demoVenue, "nowhere")).toEqual({
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
