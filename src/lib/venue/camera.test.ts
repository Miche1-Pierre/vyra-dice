import { describe, expect, it } from "vitest"

import {
  facingVector,
  overviewPose,
  seatPose,
  tableMarkerPosition,
  tablePose,
  venueCenter,
  zonePose,
} from "@/lib/venue/camera"
import { getLayout } from "@/lib/venue/layout"

const layout = getLayout("naho")!
const under = layout.heights.mezzanine - layout.heights.slab

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

describe("overviewPose", () => {
  it("frames the venue from above, wider on portrait screens", () => {
    const portrait = overviewPose(layout, 0.46)
    const wide = overviewPose(layout, 1.78)
    for (const pose of [portrait, wide]) {
      expect(pose.position[1]).toBeGreaterThan(layout.heights.ceiling + 10)
    }
    expect(portrait.fov).toBeGreaterThan(wide.fov)
  })

  it("looks at the middle of the building", () => {
    const c = venueCenter(layout)
    const pose = overviewPose(layout, 1.78)
    expect(Math.abs(pose.target[0] - c[0])).toBeLessThan(1)
  })
})

describe("zonePose", () => {
  it("keeps the camera under the slab for the ground-floor lounge below the mezzanine", () => {
    const pose = zonePose(layout, "lounge-mezzanine", 1.6)
    expect(pose.position[1]).toBeLessThan(under)
  })

  it("looks at mezzanine zones from above their floor", () => {
    const pose = zonePose(layout, "vip-est", 1.6)
    expect(pose.position[1]).toBeGreaterThan(layout.heights.mezzanine)
  })
})

describe("tablePose / seatPose", () => {
  it("frames every table from the side its guests face", () => {
    for (const t of layout.tables) {
      const pose = tablePose(layout, t.id, 1.6)
      const f = facingVector(t.facing)
      const dx = pose.position[0] - pose.target[0]
      const dz = pose.position[2] - pose.target[2]
      expect(dx * f[0] + dz * f[2]).toBeGreaterThan(0)
    }
  })

  it("puts the eye at seated height on the booth", () => {
    const t = layout.tables.find((x) => x.id === "v4")!
    const pose = seatPose(layout, t.id, 1.6)
    expect(pose.position[1]).toBeCloseTo(layout.heights.mezzanine + 1.18, 1)
    expect(pose.target[1]).toBeLessThan(pose.position[1])
  })

  it("places markers above the table", () => {
    const t = layout.tables.find((x) => x.id === "l1")!
    expect(tableMarkerPosition(layout, t)[1]).toBeGreaterThan(1)
  })
})
