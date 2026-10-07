import { describe, expect, it } from "vitest"

import layoutJson from "@art/layouts/naho.json"
import {
  getLayout,
  layouts,
  levelHeight,
  parseLayout,
  tableFootprint,
  tableLevel,
  toThree,
  type LayoutTable,
  type VenueLayout,
} from "@/lib/venue/layout"

function nahoLayout(): VenueLayout {
  const layout = getLayout("naho")
  if (!layout) throw new Error("naho layout missing")
  return layout
}

function table(layout: VenueLayout, id: string): LayoutTable {
  const found = layout.tables.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`table ${id} missing`)
  return found
}

describe("layouts", () => {
  it("parses the Naho export", () => {
    const layout = nahoLayout()
    expect(layout).toBe(layouts.naho)
    expect(layout.club).toBe("naho")
    expect(layout.zones.length).toBeGreaterThan(0)
    expect(layout.tables.length).toBeGreaterThan(0)
  })

  it("returns null for unknown clubs, including prototype keys", () => {
    expect(getLayout("unknown")).toBeNull()
    expect(getLayout("constructor")).toBeNull()
    expect(getLayout("__proto__")).toBeNull()
  })
})

describe("parseLayout", () => {
  const clone = () => structuredClone(layoutJson) as { tables: { id: string; zone: string }[] }

  it("rejects a table that references an unknown zone", () => {
    const json = clone()
    json.tables[0].zone = "nowhere"
    expect(() => parseLayout(json)).toThrow(/Invalid venue layout[\s\S]*Unknown zone "nowhere"/)
  })

  it("rejects duplicate table ids", () => {
    const json = clone()
    json.tables[1].id = json.tables[0].id
    expect(() => parseLayout(json)).toThrow(/Duplicate table id/)
  })

  it("rejects malformed geometry", () => {
    expect(() => parseLayout({ ...layoutJson, tables: [] })).toThrow(/Invalid venue layout/)
    expect(() => parseLayout(null)).toThrow(/Invalid venue layout/)
  })
})

describe("toThree", () => {
  it("maps Blender (x, y, z) to three.js (x, z, -y)", () => {
    expect(toThree([1, 2, 3])).toEqual([1, 3, -2])
    expect(toThree([-4.5, -6, 0])).toEqual([-4.5, 0, 6])
  })

  it("never produces -0", () => {
    expect(Object.is(toThree([1, 0, 3])[2], 0)).toBe(true)
  })
})

describe("table helpers", () => {
  const layout = nahoLayout()

  it("reads the level from the table's zone", () => {
    expect(tableLevel(layout, table(layout, "l1"))).toBe(0)
    // The "mezzanine" lounge sits under the slab, on the ground floor.
    expect(tableLevel(layout, table(layout, "l6"))).toBe(0)
    expect(tableLevel(layout, table(layout, "v1"))).toBe(1)
    expect(tableLevel(layout, table(layout, "p2"))).toBe(1)
  })

  it("throws when the zone is missing", () => {
    const orphan: LayoutTable = { ...table(layout, "l1"), zone: "nowhere" }
    expect(() => tableLevel(layout, orphan)).toThrow(/unknown zone/)
  })

  it("gives the floor height of each level", () => {
    expect(levelHeight(layout, 0)).toBe(0)
    expect(levelHeight(layout, 1)).toBe(layout.heights.mezzanine)
  })

  it("gives the booth footprint of the table kind", () => {
    const { prestige, lounge } = layout.furniture
    expect(tableFootprint(layout, table(layout, "p1"))).toEqual({
      width: prestige.width,
      depth: prestige.depth,
    })
    expect(tableFootprint(layout, table(layout, "l1"))).toEqual({
      width: lounge.width,
      depth: lounge.depth,
    })
  })
})
