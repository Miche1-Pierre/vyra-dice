/*
 * Edges of the venue for the neon intro, computed off the main thread (neon-edges.worker.ts).
 * Same rule as three's EdgesGeometry: an edge shows where two faces meet at more than
 * `thresholdDeg`, or where a face has no neighbour. No three.js here: the worker stays small.
 */

/** One mesh of the venue: world-space positions, and its index when it has one. */
export interface EdgeMesh {
  positions: Float32Array
  index: Uint32Array | Uint16Array | null
}

export interface EdgeRequest {
  meshes: EdgeMesh[]
  thresholdDeg: number
  /** Where the drawing starts (world space, three.js axes), and how far and high it goes. */
  origin: [number, number, number]
  reach: number
  height: number
}

/** Line segments, two vertices each: `seg` is 0 at a segment's start and 1 at its end. */
export interface NeonEdges {
  positions: Float32Array
  seg: Float32Array
  /** 0 → 1: when the segment starts drawing (centre and floor first, the far walls last). */
  delay: Float32Array
}

const PRECISION = 1e4

export function computeNeonEdges({
  meshes,
  thresholdDeg,
  origin,
  reach,
  height,
}: EdgeRequest): NeonEdges {
  const thresholdDot = Math.cos((thresholdDeg * Math.PI) / 180)
  const out: number[] = []

  for (const { positions, index } of meshes) {
    const count = index ? index.length : positions.length / 3
    const edges = new Map<string, { a: number; b: number; nx: number; ny: number; nz: number }>()
    const key = (i: number) =>
      `${Math.round(positions[i * 3] * PRECISION)},${Math.round(positions[i * 3 + 1] * PRECISION)},${Math.round(positions[i * 3 + 2] * PRECISION)}`

    for (let t = 0; t + 2 < count; t += 3) {
      const v = index ? [index[t], index[t + 1], index[t + 2]] : [t, t + 1, t + 2]
      // face normal: (c - b) × (a - b)
      const [a, b, c] = v
      const bx = positions[b * 3]
      const by = positions[b * 3 + 1]
      const bz = positions[b * 3 + 2]
      const ux = positions[c * 3] - bx
      const uy = positions[c * 3 + 1] - by
      const uz = positions[c * 3 + 2] - bz
      const wx = positions[a * 3] - bx
      const wy = positions[a * 3 + 1] - by
      const wz = positions[a * 3 + 2] - bz
      let nx = uy * wz - uz * wy
      let ny = uz * wx - ux * wz
      let nz = ux * wy - uy * wx
      const len = Math.hypot(nx, ny, nz)
      if (len === 0) continue // degenerate triangle
      nx /= len
      ny /= len
      nz /= len
      const hashes = [key(a), key(b), key(c)]
      for (let j = 0; j < 3; j++) {
        const j1 = (j + 1) % 3
        const hash = `${hashes[j]}_${hashes[j1]}`
        const reverse = `${hashes[j1]}_${hashes[j]}`
        const twin = edges.get(reverse)
        if (twin) {
          // shared edge: a line only where the surface folds
          if (nx * twin.nx + ny * twin.ny + nz * twin.nz <= thresholdDot)
            push(out, positions, v[j], v[j1])
          edges.delete(reverse)
        } else if (!edges.has(hash)) {
          edges.set(hash, { a: v[j], b: v[j1], nx, ny, nz })
        }
      }
    }
    // edges with a single face: the outline of the surface
    for (const e of edges.values()) push(out, positions, e.a, e.b)
  }

  const positions = new Float32Array(out)
  const vertices = positions.length / 3
  const seg = new Float32Array(vertices)
  const delay = new Float32Array(vertices)
  for (let s = 0; s < vertices; s += 2) {
    seg[s + 1] = 1
    const mx = (positions[s * 3] + positions[s * 3 + 3]) / 2 - origin[0]
    const my = (positions[s * 3 + 1] + positions[s * 3 + 4]) / 2 - origin[1]
    const mz = (positions[s * 3 + 2] + positions[s * 3 + 5]) / 2 - origin[2]
    const d = Math.min(1, Math.hypot(mx, mz) / reach)
    const h = Math.min(1, Math.max(0, my / height))
    delay[s] = delay[s + 1] = 0.65 * d + 0.35 * h
  }
  return { positions, seg, delay }
}

function push(out: number[], p: Float32Array, a: number, b: number) {
  out.push(p[a * 3], p[a * 3 + 1], p[a * 3 + 2], p[b * 3], p[b * 3 + 1], p[b * 3 + 2])
}
