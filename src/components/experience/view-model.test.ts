import { describe, expect, it } from "vitest"

import { buildViewModel } from "@/components/experience/view-model"
import { getVenueContent } from "@/content/clubs"
import { getLayout } from "@/lib/venue/layout"

const content = getVenueContent("naho", "samedi")!
const layout = getLayout("naho")!
const vm = buildViewModel(content, layout)

describe("buildViewModel", () => {
  it("joins every table of the layout with its commercial content", () => {
    expect(Object.keys(vm.tables)).toHaveLength(layout.tables.length)
    expect(vm.tableMarkers).toHaveLength(layout.tables.length)
  })

  it("orders zones lounge → vip → prestige", () => {
    const tiers = vm.zones.map((z) => z.tier)
    expect(tiers.indexOf("vip")).toBeGreaterThan(tiers.lastIndexOf("lounge"))
    expect(tiers.indexOf("prestige")).toBeGreaterThan(tiers.lastIndexOf("vip"))
  })

  it("ignores sold tables in the 'from' price and counts availability", () => {
    const gold = vm.zones.find((z) => z.id === "lounge-mezzanine")!
    expect(gold.total).toBe(5)
    expect(gold.available).toBe(4) // l7 is sold
    expect(gold.fromMinimum).toBe(350)
  })

  it("adds zone perks to each table and reads the level from the layout", () => {
    const v4 = vm.tables.v4
    expect(v4.level).toBe(1)
    expect(v4.perks).toContain("Accès coupe-file")
    expect(vm.tables.l1.level).toBe(0)
  })

  it("prices per person on the maximum capacity", () => {
    const p1 = vm.tables.p1
    expect(p1.perPerson).toBe(Math.ceil(p1.minimumSpend! / p1.capacity.max))
  })
})
