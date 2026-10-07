import {
  levelHeight,
  tableFootprint,
  tableLevel,
  toThree,
  type LayoutTable,
  type VenueLayout,
} from "@/lib/venue/layout"

/** Camera pose in three.js world space (metres). */
export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
  /** Vertical field of view to use for this pose. */
  fov: number
}

type Vec3 = [number, number, number]

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]

/** Unit vector (three.js XZ plane) for a layout ``facing`` angle (0 = east, 90 = north). */
export function facingVector(facingDeg: number): Vec3 {
  const a = (facingDeg * Math.PI) / 180
  // Blender (cos, sin, 0) -> three (x, z, -y)
  return [Math.cos(a), 0, -Math.sin(a)]
}

/** Centre of the building at floor level, in three.js space. */
export function venueCenter(layout: VenueLayout): Vec3 {
  const b = layout.building
  return toThree([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0])
}

function isUnderSlab(layout: VenueLayout, x: number, y: number): boolean {
  return layout.mezzanine.some((r) => r.x[0] < x && x < r.x[1] && r.y[0] < y && y < r.y[1])
}

/** Spherical offset: azimuth 0 = camera south of the target (three +Z), polar from the zenith. */
function orbit(target: Vec3, distance: number, azimuthDeg: number, polarDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180
  const po = (polarDeg * Math.PI) / 180
  return [
    target[0] + distance * Math.sin(po) * Math.sin(az),
    target[1] + distance * Math.cos(po),
    target[2] + distance * Math.sin(po) * Math.cos(az),
  ]
}

/** Establishing view of the whole venue, tuned separately for portrait phones and wide screens. */
export function overviewPose(layout: VenueLayout, aspect: number): CameraPose {
  const center = add(venueCenter(layout), [0, 1.5, 0])
  if (aspect < 0.8) {
    const target = add(center, [0, 0, -2.5])
    return { target, position: orbit(target, 64, 10, 40), fov: 56 }
  }
  if (aspect < 1.3) {
    return { target: center, position: orbit(center, 58, 28, 46), fov: 46 }
  }
  return { target: center, position: orbit(center, 50, 36, 50), fov: 40 }
}

/** Average facing of the tables of a zone (they all look towards the room). */
function zoneFacing(layout: VenueLayout, zoneId: string): Vec3 {
  const tables = layout.tables.filter((t) => t.zone === zoneId)
  const sum = tables.reduce<Vec3>((acc, t) => add(acc, facingVector(t.facing)), [0, 0, 0])
  const len = Math.hypot(sum[0], sum[2]) || 1
  return [sum[0] / len, 0, sum[2] / len]
}

export function zonePose(layout: VenueLayout, zoneId: string, aspect: number): CameraPose {
  const zone = layout.zones.find((z) => z.id === zoneId)
  if (!zone) return overviewPose(layout, aspect)
  const cx = (zone.x[0] + zone.x[1]) / 2
  const cy = (zone.y[0] + zone.y[1]) / 2
  const floor = levelHeight(layout, zone.level)
  const target = toThree([cx, cy, floor + 0.6])
  const f = zoneFacing(layout, zoneId)
  const span = Math.max(zone.x[1] - zone.x[0], zone.y[1] - zone.y[0])
  const portrait = aspect < 0.8
  const dist = span * (portrait ? 1.15 : 0.8) + 6
  const lowCeiling = zone.level === 0 && isUnderSlab(layout, cx, cy)
  const height = lowCeiling ? 2.7 - (floor + 0.6) : dist * 0.55
  const horizontal = lowCeiling ? dist : dist * 0.84
  const position = add(add(target, scale(f, horizontal)), [0, height, 0])
  return { target, position, fov: portrait ? 58 : 44 }
}

function tableAnchor(layout: VenueLayout, table: LayoutTable): Vec3 {
  const floor = levelHeight(layout, tableLevel(layout, table))
  return toThree([table.x, table.y, floor])
}

export function tablePose(layout: VenueLayout, tableId: string, aspect: number): CameraPose {
  const table = layout.tables.find((t) => t.id === tableId)
  if (!table) return overviewPose(layout, aspect)
  const base = tableAnchor(layout, table)
  const target = add(base, [0, 0.55, 0])
  const f = facingVector(table.facing)
  const { width } = tableFootprint(layout, table)
  const portrait = aspect < 0.8
  const dist = width * (portrait ? 1.9 : 1.35) + 2.4
  const level = tableLevel(layout, table)
  const lowCeiling = level === 0 && isUnderSlab(layout, table.x, table.y)
  const height = lowCeiling ? 2.6 - base[1] : dist * 0.5
  const position = add(add(target, scale(f, dist)), [0, height, 0])
  return { target, position, fov: portrait ? 58 : 44 }
}

/** First-person view from the back seat of the booth, looking at the room. */
export function seatPose(layout: VenueLayout, tableId: string, aspect: number): CameraPose {
  const table = layout.tables.find((t) => t.id === tableId)
  if (!table) return overviewPose(layout, aspect)
  const base = tableAnchor(layout, table)
  const f = facingVector(table.facing)
  const { depth } = tableFootprint(layout, table)
  const eye = add(add(base, scale(f, -(depth / 2 - 0.42))), [0, 1.18, 0])
  const target = add(add(eye, scale(f, 6)), [0, -0.9, 0])
  return { position: eye, target, fov: aspect < 0.8 ? 72 : 62 }
}

/** Anchor of a table's price marker (three.js space). */
export function tableMarkerPosition(layout: VenueLayout, table: LayoutTable): Vec3 {
  return add(tableAnchor(layout, table), [0, 1.55, 0])
}

/** Anchor of a zone marker (three.js space). */
export function zoneMarkerPosition(layout: VenueLayout, zoneId: string): Vec3 {
  const zone = layout.zones.find((z) => z.id === zoneId)
  if (!zone) return venueCenter(layout)
  const floor = levelHeight(layout, zone.level)
  return toThree([(zone.x[0] + zone.x[1]) / 2, (zone.y[0] + zone.y[1]) / 2, floor + 2.6])
}
