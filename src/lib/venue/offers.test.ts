import { describe, expect, it } from "vitest"

import type { VenueContent } from "@/lib/schema"
import { minimumFor, pricePerPerson, quoteFor, tierRank, zoneSummary } from "@/lib/venue/offers"
import { demoVenue } from "@/test/fixtures"

/** A table for 6, up to 2 more at +150 € each, 20 % deposit (the reference audit's example). */
const withSupplement = {
  minimumSpend: 900,
  capacity: { min: 6, max: 8 },
  surcharge: { includedGuests: 6, perGuest: 150 },
  deposit: { percent: 20 },
}

describe("pricePerPerson", () => {
  it("splits the minimum spend over a full table, rounded up", () => {
    expect(pricePerPerson({ minimumSpend: 350, capacity: { min: 4, max: 6 } })).toBe(59)
    expect(pricePerPerson({ minimumSpend: 1000, capacity: { min: 6, max: 8 } })).toBe(125)
  })

  it("counts the supplements of a full table", () => {
    // 900 € + 2 × 150 € for 8 guests
    expect(pricePerPerson(withSupplement)).toBe(150)
  })

  it("is null when the price is on request", () => {
    expect(pricePerPerson({ minimumSpend: null, capacity: { min: 4, max: 6 } })).toBeNull()
  })
})

describe("minimumFor", () => {
  it("keeps the table's minimum without a supplement", () => {
    expect(minimumFor({ minimumSpend: 350, capacity: { min: 4, max: 6 } }, 6)).toBe(350)
  })

  it("adds the supplement for each guest above the included ones", () => {
    expect(minimumFor(withSupplement, 6)).toBe(900)
    expect(minimumFor(withSupplement, 7)).toBe(1050)
    expect(minimumFor(withSupplement, 8)).toBe(1200)
  })

  it("is null when the price is on request", () => {
    expect(minimumFor({ minimumSpend: null, capacity: { min: 6, max: 8 } }, 7)).toBeNull()
  })
})

describe("quoteFor", () => {
  it("recomputes the minimum, the share and the deposit for the group", () => {
    expect(quoteFor(withSupplement, 6)).toEqual({
      guests: 6,
      extraGuests: 0,
      minimumSpend: 900,
      perPerson: 150,
      deposit: 180,
    })
    expect(quoteFor(withSupplement, 8)).toEqual({
      guests: 8,
      extraGuests: 2,
      minimumSpend: 1200,
      perPerson: 150,
      deposit: 240,
    })
  })

  it("shares the minimum over the actual group", () => {
    const quote = quoteFor({ minimumSpend: 350, capacity: { min: 4, max: 6 } }, 4)
    expect(quote).toMatchObject({ minimumSpend: 350, perPerson: 88, deposit: null })
  })

  it("keeps a fixed deposit even when the price is on request", () => {
    const quote = quoteFor(
      { minimumSpend: null, capacity: { min: 6, max: 8 }, deposit: { amount: 200 } },
      6,
    )
    expect(quote).toMatchObject({ minimumSpend: null, perPerson: null, deposit: 200 })
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
