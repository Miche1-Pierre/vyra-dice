import { describe, expect, it } from "vitest"

import { availabilityOf, buildViewModel } from "@/components/experience/view-model"
import { listClubs } from "@/lib/clubs/registry"
import { tableLevel } from "@/lib/venue/layout"
import { tierRank } from "@/lib/venue/offers"

describe.each(listClubs().map((club) => [club.slug, club] as const))(
  "buildViewModel (%s)",
  (_, { content, layout }) => {
    const vm = buildViewModel(content, layout)

    it("joins every table of the layout with its commercial content", () => {
      expect(Object.keys(vm.tables)).toHaveLength(layout.tables.length)
      expect(vm.tableMarkers).toHaveLength(layout.tables.length)
      expect(vm.zones).toHaveLength(layout.zones.length)
    })

    it("orders zones lounge → vip → prestige", () => {
      const ranks = vm.zones.map((zone) => tierRank(zone.tier))
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    })

    it("ignores sold tables in the 'from' price and counts availability", () => {
      for (const zone of vm.zones) {
        const tables = content.tables.filter((table) => table.zoneId === zone.id)
        const open = tables.filter((table) => table.status !== "sold")
        const prices = open.flatMap((table) =>
          table.minimumSpend === null ? [] : [table.minimumSpend],
        )
        expect(zone.total, zone.id).toBe(tables.length)
        expect(zone.available, zone.id).toBe(tables.filter((t) => t.status === "available").length)
        expect(zone.fromMinimum, zone.id).toBe(prices.length ? Math.min(...prices) : null)
      }
    })

    it("adds zone perks to each table and reads the level from the layout", () => {
      for (const table of layout.tables) {
        const view = vm.tables[table.id]
        const zone = content.zones.find((candidate) => candidate.id === table.zone)!
        expect(view.perks, table.id).toEqual(expect.arrayContaining(zone.perks))
        expect(view.level, table.id).toBe(tableLevel(layout, table))
      }
    })

    it("prices per person on the maximum capacity", () => {
      for (const table of Object.values(vm.tables)) {
        const expected =
          table.minimumSpend === null ? null : Math.ceil(table.minimumSpend / table.capacity.max)
        expect(table.perPerson, table.id).toBe(expected)
      }
    })
  },
)

describe("availabilityOf", () => {
  it("counts bookable tables, then falls back to 'on request' and 'sold out'", () => {
    expect(availabilityOf([{ status: "available" }, { status: "sold" }])).toEqual({
      label: "1/2 dispo",
      tone: "available",
    })
    expect(availabilityOf([{ status: "on_request" }, { status: "sold" }])).toEqual({
      label: "Sur demande",
      tone: "on_request",
    })
    expect(availabilityOf([{ status: "sold" }])).toEqual({ label: "Complet", tone: "sold" })
  })
})
