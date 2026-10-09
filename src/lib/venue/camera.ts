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
    return { target: center, position: orbit(center, 60, 28, 46), fov: 46 }
  }
  const target = add(center, [0, 0, 1.5])
  if (aspect >= 1.95) {
    // very wide (phones held sideways, ultrawide): height is the limit, step back
    return { target, position: orbit(target, 66, 36, 50), fov: 38 }
  }
  return { target, position: orbit(target, 55, 36, 50), fov: 40 }
}

/** Elevation of the camera above the horizon (degrees) when looking at a zone or a table. */
function elevationFor(
  level: 0 | 1,
  lowCeiling: boolean,
  steep: number,
  ground: number,
): number | null {
  if (lowCeiling) return null // camera must stay below the slab
  // mezzanine: look down from above the LED rain and the trusses (the roof is cut away)
  return level === 1 ? steep : ground
}

/** Average facing of the tables of a zone (they all look towards the room). */
function zoneFacing(layout: VenueLayout, zoneId: string): Vec3 {
  const tables = layout.tables.filter((t) => t.zone === zoneId)
  const sum = tables.reduce<Vec3>((acc, t) => add(acc, facingVector(t.facing)), [0, 0, 0])
  const len = Math.hypot(sum[0], sum[2]) || 1
  return [sum[0] / len, 0, sum[2] / len]
}

/** Rotates a horizontal three.js direction around the vertical axis. */
function rotateY(v: Vec3, deg: number): Vec3 {
  const a = (deg * Math.PI) / 180
  return [v[0] * Math.cos(a) + v[2] * Math.sin(a), 0, -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
}

/** Is a three.js point inside the public ground floor (level 0) or the building (level 1)? */
function insideVenue(layout: VenueLayout, p: Vec3, level: 0 | 1): boolean {
  const x = p[0]
  const y = -p[2] // back to Blender north
  if (level === 0) {
    const g = layout.groundFloor
    return x > g.x[0] + 0.5 && x < g.x[1] - 0.5 && y > g.y[0] + 0.5 && y < g.y[1] - 0.5
  }
  const b = layout.building
  return x > b.minX && x < b.maxX && y > b.minY && y < b.maxY
}

export function zonePose(layout: VenueLayout, zoneId: string, aspect: number): CameraPose {
  const zone = layout.zones.find((z) => z.id === zoneId)
  if (!zone) return overviewPose(layout, aspect)
  const cx = (zone.x[0] + zone.x[1]) / 2
  const cy = (zone.y[0] + zone.y[1]) / 2
  const floor = levelHeight(layout, zone.level)
  const target = toThree([cx, cy, floor + 0.6])
  const facing = zoneFacing(layout, zoneId)
  const w = zone.x[1] - zone.x[0]
  const d = zone.y[1] - zone.y[0]
  const span = Math.max(w, d)
  const portrait = aspect < 0.8
  const lowCeiling = zone.level === 0 && isUnderSlab(layout, cx, cy)
  const elevation = elevationFor(zone.level, lowCeiling, 46, 36)

  // On a tall screen, look along an elongated zone (row of booths in perspective) instead of
  // across it, picking the side that keeps the camera inside the venue.
  const along = portrait && span / Math.min(w, d) > 2.2
  const place = (dir: Vec3): Vec3 => {
    if (elevation === null) {
      const dist = along ? Math.min(w, d) * 2.4 + 6 : span * (portrait ? 1.15 : 0.8) + 6
      return add(add(target, scale(dir, dist)), [0, 2.7 - (floor + 0.6), 0])
    }
    const dist = along ? span * 0.6 + 6 : span * (portrait ? 1.0 : 0.62) + 7
    const e = (elevation * Math.PI) / 180
    return add(add(target, scale(dir, dist * Math.cos(e))), [0, dist * Math.sin(e), 0])
  }
  let position = place(facing)
  if (along) {
    const options = [rotateY(facing, 52), rotateY(facing, -52)].map(place)
    position = options.find((p) => insideVenue(layout, p, zone.level)) ?? options[0]
  }
  return { target, position, fov: portrait ? 60 : 44 }
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
  const level = tableLevel(layout, table)
  const lowCeiling = level === 0 && isUnderSlab(layout, table.x, table.y)
  const elevation = elevationFor(level, lowCeiling, 40, 30)
  // three-quarter view: the booth reads in volume and the room it faces stays in frame
  const dir = rotateY(f, portrait ? 18 : 26)
  let position: Vec3
  if (elevation === null) {
    const dist = width * (portrait ? 1.9 : 1.35) + 2.4
    position = add(add(target, scale(dir, dist)), [0, 2.6 - base[1], 0])
  } else {
    const dist = portrait ? width * 2.2 + 5.5 : width * 1.45 + 4
    const e = (elevation * Math.PI) / 180
    position = add(add(target, scale(dir, dist * Math.cos(e))), [0, dist * Math.sin(e), 0])
  }
  return { target, position, fov: portrait ? 56 : 40 }
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
  const cx = (zone.x[0] + zone.x[1]) / 2
  const cy = (zone.y[0] + zone.y[1]) / 2
  if (zone.level === 0 && isUnderSlab(layout, cx, cy)) {
    // under the mezzanine: pin the tag against the back wall so it doesn't sit on the slab's tag
    const f = zoneFacing(layout, zoneId)
    const back = Math.min(zone.x[1] - zone.x[0], zone.y[1] - zone.y[0]) / 2 - 0.3
    const c = toThree([cx, cy, floor + 1.7])
    return add(c, scale(f, -back))
  }
  return toThree([cx, cy, floor + 2.6])
}

/** How far the buyer may look around a viewpoint: never a free flight through the venue. */
export interface LookLimits {
  /** Turn left or right of the viewpoint's direction, in degrees. */
  azimuthDeg: number
  /** Tilt up or down from it, in degrees; `null` keeps the rig's own range. */
  polarDeg: number | null
  /** Closest and farthest distance as a share of the viewpoint's; `null` keeps the rig's own. */
  zoom: [number, number] | null
}

/** Limits per view: the overview turns the most, the seat looks around without moving. */
export const LOOK_LIMITS = {
  overview: { azimuthDeg: 60, polarDeg: 12, zoom: [0.6, 1.25] },
  zone: { azimuthDeg: 45, polarDeg: 10, zoom: [0.65, 1.3] },
  table: { azimuthDeg: 40, polarDeg: 10, zoom: [0.65, 1.35] },
  seat: { azimuthDeg: 135, polarDeg: null, zoom: null },
} satisfies Record<string, LookLimits>

export type LookKind = keyof typeof LOOK_LIMITS

/** Spherical bounds (radians, metres) for camera-controls around a viewpoint. */
export interface LookBounds {
  /** Direction of the viewpoint itself, `atan2(x, z)` in [-π, π]. */
  azimuth: number
  minAzimuth: number
  maxAzimuth: number
  minPolar: number | null
  maxPolar: number | null
  minDistance: number | null
  maxDistance: number | null
}

/**
 * Bounds around a camera pose, as camera-controls measures it: azimuth `atan2(x, z)` and polar
 * angle from the zenith of the offset camera − target. The pose itself is always inside them;
 * the polar range is also kept within `[minPolar, maxPolar]` of the rig when possible.
 */
export function lookBounds(
  pose: Pick<CameraPose, "position" | "target">,
  limits: LookLimits,
  polarRange: [number, number] = [0, Math.PI],
): LookBounds {
  const dx = pose.position[0] - pose.target[0]
  const dy = pose.position[1] - pose.target[1]
  const dz = pose.position[2] - pose.target[2]
  const distance = Math.hypot(dx, dy, dz)
  const azimuth = Math.atan2(dx, dz)
  const polar = Math.acos(Math.min(1, Math.max(-1, dy / (distance || 1))))
  const rad = (deg: number) => (deg * Math.PI) / 180
  const turn = rad(limits.azimuthDeg)
  const tilt = limits.polarDeg === null ? null : rad(limits.polarDeg)
  return {
    azimuth,
    minAzimuth: azimuth - turn,
    maxAzimuth: azimuth + turn,
    minPolar: tilt === null ? null : Math.min(polar, Math.max(polarRange[0], polar - tilt)),
    maxPolar: tilt === null ? null : Math.max(polar, Math.min(polarRange[1], polar + tilt)),
    minDistance: limits.zoom ? distance * limits.zoom[0] : null,
    maxDistance: limits.zoom ? distance * limits.zoom[1] : null,
  }
}
