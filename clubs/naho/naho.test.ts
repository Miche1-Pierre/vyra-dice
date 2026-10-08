import { describe, expect, it } from "vitest"

import { buildViewModel } from "@/components/experience/view-model"
import type { Tier } from "@/lib/schema"
import { seatPose, zonePose } from "@/lib/venue/camera"
import { tableLevel } from "@/lib/venue/layout"
import { zoneSummary } from "@/lib/venue/offers"

import naho from "./index"

/*
 * What the Naho demo shows, checked against its sketch (reference/plan-sketch.png). The rules
 * every club must follow are tested in src/ (club registry, camera, view model).
 */

const { content, layout } = naho
const table = (id: string) => layout.tables.find((candidate) => candidate.id === id)!

describe("Naho demo offers", () => {
  it("prices every prestige table above every VIP table, and every VIP above every lounge", () => {
    const tierOf = new Map(content.zones.map((zone) => [zone.id, zone.tier]))
    const spends = (tier: Tier) =>
      content.tables
        .filter((t) => tierOf.get(t.zoneId) === tier)
        .flatMap((t) => (t.minimumSpend === null ? [] : [t.minimumSpend]))
    const [lounge, vip, prestige] = [spends("lounge"), spends("vip"), spends("prestige")]
    expect(lounge.length && vip.length && prestige.length).toBeGreaterThan(0)
    expect(Math.min(...prestige)).toBeGreaterThan(Math.max(...vip))
    expect(Math.min(...vip)).toBeGreaterThan(Math.max(...lounge))
  })

  it("labels tables with their uppercase id", () => {
    for (const t of content.tables) expect(t.label).toBe(t.id.toUpperCase())
  })

  it("is flagged as an unvalidated demo", () => {
    expect(content.club.demo).toBe(true)
    expect(content.club.disclaimer).toMatch(/^Démo/)
    expect(content.event.offersValidatedAt).toBeNull()
  })

  it("summarises the zones as the sales pitch tells them", () => {
    // l2 (350 €) is sold, l1 (350 €) is not.
    expect(zoneSummary(content, "lounge-vegetal")).toEqual({
      fromMinimum: 350,
      fromPerPerson: 59,
      available: 4,
      total: 5,
    })
    // v5 (750 €) is sold; the cheapest open tables are v6 / v7 at 700 €.
    expect(zoneSummary(content, "vip-est")).toEqual({
      fromMinimum: 700,
      fromPerPerson: 88,
      available: 3,
      total: 4,
    })
    // the single prestige table by the DJ is on request
    expect(zoneSummary(content, "prestige-dj")).toEqual({
      fromMinimum: 2500,
      fromPerPerson: 167,
      available: 1,
      total: 1,
    })
  })

  it("counts the sold table of the gold lounge", () => {
    const gold = buildViewModel(content, layout).zones.find((z) => z.id === "lounge-mezzanine")!
    expect(gold.total).toBe(5)
    expect(gold.available).toBe(4) // l7 is sold
    expect(gold.fromMinimum).toBe(350)
  })
})

describe("Naho plan", () => {
  it("puts the lounges on the ground floor and VIP / prestige on the mezzanine", () => {
    expect(tableLevel(layout, table("l1"))).toBe(0)
    // the "mezzanine" lounge sits under the slab, on the ground floor
    expect(tableLevel(layout, table("l6"))).toBe(0)
    expect(tableLevel(layout, table("v1"))).toBe(1)
    expect(tableLevel(layout, table("p2"))).toBe(1)
  })

  it("films the gold lounge from under the slab", () => {
    const under = layout.heights.mezzanine - layout.heights.slab
    for (const aspect of [0.46, 1.6]) {
      expect(zonePose(layout, "lounge-mezzanine", aspect).position[1]).toBeLessThan(under)
    }
  })

  it("seats the guest of V4 on the mezzanine", () => {
    const pose = seatPose(layout, "v4", 1.6)
    expect(pose.position[1]).toBeCloseTo(layout.heights.mezzanine + 1.18, 1)
  })
})
