import { describe, expect, it } from "vitest"

import { listClubs } from "@/lib/clubs/registry"
import {
  facingVector,
  LOOK_LIMITS,
  lookBounds,
  overviewPose,
  seatPose,
  tableMarkerPosition,
  tablePose,
  venueCenter,
  zonePose,
} from "@/lib/venue/camera"
import { levelHeight, tableLevel, type LayoutZone, type VenueLayout } from "@/lib/venue/layout"

const PORTRAIT = 0.46
const LANDSCAPE = 1.6
const WIDE = 1.78

/** A ground-floor zone whose centre sits under a mezzanine slab. */
function underSlab(layout: VenueLayout, zone: LayoutZone): boolean {
  const x = (zone.x[0] + zone.x[1]) / 2
  const y = (zone.y[0] + zone.y[1]) / 2
  return (
    zone.level === 0 &&
    layout.mezzanine.some((r) => r.x[0] < x && x < r.x[1] && r.y[0] < y && y < r.y[1])
  )
}

describe("facingVector", () => {
  it("maps layout angles to the three.js XZ plane", () => {
    const east = facingVector(0)
    expect(east[0]).toBeCloseTo(1)
    expect(east[2]).toBeCloseTo(0)
    const north = facingVector(90)
    expect(north[0]).toBeCloseTo(0)
    expect(north[2]).toBeCloseTo(-1) // Blender +y is three -z
  })
})

// Camera rules every club must satisfy, whatever its plan.
describe.each(listClubs().map((club) => [club.slug, club.layout] as const))(
  "camera poses (%s)",
  (_, layout) => {
    const slabUnderside = layout.heights.mezzanine - layout.heights.slab

    it("frames the venue from above, wider on portrait screens", () => {
      const portrait = overviewPose(layout, PORTRAIT)
      const wide = overviewPose(layout, WIDE)
      for (const pose of [portrait, wide]) {
        expect(pose.position[1]).toBeGreaterThan(layout.heights.ceiling + 10)
      }
      expect(portrait.fov).toBeGreaterThan(wide.fov)
    })

    it("looks at the middle of the building", () => {
      const pose = overviewPose(layout, WIDE)
      expect(Math.abs(pose.target[0] - venueCenter(layout)[0])).toBeLessThan(1)
    })

    it("keeps the camera under the slab for ground-floor zones below the mezzanine", () => {
      for (const zone of layout.zones.filter((z) => underSlab(layout, z))) {
        for (const aspect of [PORTRAIT, LANDSCAPE]) {
          expect(zonePose(layout, zone.id, aspect).position[1], zone.id).toBeLessThan(slabUnderside)
        }
      }
    })

    it("looks along ground-floor zones on portrait screens without leaving the venue", () => {
      const g = layout.groundFloor
      for (const zone of layout.zones.filter((z) => z.level === 0)) {
        const [x, , z] = zonePose(layout, zone.id, PORTRAIT).position
        const y = -z
        expect(x, zone.id).toBeGreaterThan(g.x[0])
        expect(x, zone.id).toBeLessThan(g.x[1])
        expect(y, zone.id).toBeGreaterThan(g.y[0])
        expect(y, zone.id).toBeLessThan(g.y[1])
      }
    })

    it("looks at mezzanine zones from above their floor", () => {
      for (const zone of layout.zones.filter((z) => z.level === 1)) {
        const pose = zonePose(layout, zone.id, LANDSCAPE)
        expect(pose.position[1], zone.id).toBeGreaterThan(layout.heights.mezzanine)
      }
    })

    it("frames every table from the side its guests face", () => {
      for (const t of layout.tables) {
        const pose = tablePose(layout, t.id, LANDSCAPE)
        const f = facingVector(t.facing)
        const dx = pose.position[0] - pose.target[0]
        const dz = pose.position[2] - pose.target[2]
        expect(dx * f[0] + dz * f[2], t.id).toBeGreaterThan(0)
      }
    })

    it("puts the eye at seated height on the booth, looking down at the room", () => {
      for (const t of layout.tables) {
        const pose = seatPose(layout, t.id, LANDSCAPE)
        const floor = levelHeight(layout, tableLevel(layout, t))
        expect(pose.position[1], t.id).toBeCloseTo(floor + 1.18, 1)
        expect(pose.target[1], t.id).toBeLessThan(pose.position[1])
      }
    })

    it("places markers above the tables", () => {
      for (const t of layout.tables) {
        const floor = levelHeight(layout, tableLevel(layout, t))
        expect(tableMarkerPosition(layout, t)[1], t.id).toBeGreaterThan(floor + 1)
      }
    })
  },
)

describe("lookBounds", () => {
  const deg = (rad: number) => (rad * 180) / Math.PI

  it("lets the buyer turn and tilt around the viewpoint, not fly away", () => {
    // camera 10 m south of the target and 10 m up: azimuth 0, polar 45°
    const bounds = lookBounds({ position: [0, 10, 10], target: [0, 0, 0] }, LOOK_LIMITS.table)
    expect(deg(bounds.minAzimuth)).toBeCloseTo(-40)
    expect(deg(bounds.maxAzimuth)).toBeCloseTo(40)
    expect(deg(bounds.minPolar!)).toBeCloseTo(35)
    expect(deg(bounds.maxPolar!)).toBeCloseTo(55)
    expect(bounds.minDistance).toBeCloseTo(Math.hypot(10, 10) * 0.65)
    expect(bounds.maxDistance).toBeCloseTo(Math.hypot(10, 10) * 1.35)
  })

  it("always contains the viewpoint, even beyond the rig's tilt range", () => {
    // nearly horizontal view under a low ceiling: polar ≈ 90°, rig limited to 84.6°
    const bounds = lookBounds({ position: [0, 0.1, 10], target: [0, 0, 0] }, LOOK_LIMITS.zone, [
      0.12,
      Math.PI * 0.47,
    ])
    expect(bounds.maxPolar!).toBeGreaterThanOrEqual(Math.acos(0.1 / Math.hypot(0.1, 10)))
    expect(bounds.minPolar!).toBeLessThanOrEqual(bounds.maxPolar!)
  })

  it("keeps the seat's own tilt and distance, and only bounds the turn", () => {
    const bounds = lookBounds({ position: [0, 1.2, 0], target: [0, 1.2, -0.05] }, LOOK_LIMITS.seat)
    expect(deg(bounds.maxAzimuth - bounds.minAzimuth)).toBeCloseTo(270)
    expect(bounds).toMatchObject({
      minPolar: null,
      maxPolar: null,
      minDistance: null,
      maxDistance: null,
    })
  })
})
