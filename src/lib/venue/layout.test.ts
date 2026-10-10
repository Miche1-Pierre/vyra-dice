import { describe, expect, it } from "vitest"

import { listClubs } from "@/lib/clubs/registry"
import {
  levelHeight,
  parseLayout,
  tableFootprint,
  tableLevel,
  toThree,
  type LayoutTable,
} from "@/lib/venue/layout"

/** A valid plan to break: the first registered club's. */
const valid = () => structuredClone(listClubs()[0].layout)

describe("parseLayout", () => {
  it("accepts every registered plan", () => {
    for (const club of listClubs()) expect(parseLayout(club.layout), club.slug).toEqual(club.layout)
  })

  it("rejects a table that references an unknown zone", () => {
    const json = valid()
    json.tables[0].zone = "nowhere"
    expect(() => parseLayout(json)).toThrow(/Invalid venue layout[\s\S]*Unknown zone "nowhere"/)
  })

  it("rejects duplicate table ids", () => {
    const json = valid()
    json.tables[1].id = json.tables[0].id
    expect(() => parseLayout(json)).toThrow(/Duplicate table id/)
  })

  it("accepts standing areas, but not with a zone's id", () => {
    const json = valid()
    json.standing = [{ id: "ga", level: 0, x: [-2, 2], y: [0, 4], facing: 90 }]
    expect(parseLayout(json).standing).toHaveLength(1)
    json.standing[0].id = json.zones[0].id
    expect(() => parseLayout(json)).toThrow(/Duplicate area id/)
  })

  it("accepts a raised zone, but not a sunken one", () => {
    const json = valid()
    json.zones[0].raised = 0.4
    expect(parseLayout(json).zones[0].raised).toBe(0.4)
    json.zones[0].raised = -0.2
    expect(() => parseLayout(json)).toThrow(/Invalid venue layout/)
  })

  it("rejects malformed geometry", () => {
    expect(() => parseLayout({ ...valid(), tables: [] })).toThrow(/Invalid venue layout/)
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

describe.each(listClubs().map((club) => [club.slug, club.layout] as const))(
  "table helpers (%s)",
  (_, layout) => {
    it("reads the level from the table's zone", () => {
      for (const table of layout.tables) {
        const zone = layout.zones.find((candidate) => candidate.id === table.zone)!
        expect(tableLevel(layout, table), table.id).toBe(zone.level)
      }
    })

    it("throws when the zone is missing", () => {
      const orphan: LayoutTable = { ...layout.tables[0], zone: "nowhere" }
      expect(() => tableLevel(layout, orphan)).toThrow(/unknown zone/)
    })

    it("gives the floor height of each level", () => {
      expect(levelHeight(layout, 0)).toBe(0)
      expect(levelHeight(layout, 1)).toBe(layout.heights.mezzanine)
    })

    it("gives the booth footprint of the table kind", () => {
      for (const table of layout.tables) {
        const { width, depth } = layout.furniture[table.kind]
        expect(tableFootprint(layout, table), table.id).toEqual({ width, depth })
      }
    })
  },
)
