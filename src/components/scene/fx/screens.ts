import * as THREE from "three"

/*
 * Night screens, the geometry: the flat pieces of the venue's screens, each with its own frame (U
 * left → right as seen from the front, V bottom → top), and the text that stands on them. The
 * night mode plays a video on each piece (night-screens.tsx) and hides that text meanwhile.
 */

/** One flat piece of screen, in world space: two floats of UV per vertex, three of position. */
export interface ScreenPiece {
  /** The screen mesh it belongs to (hidden while its video plays). */
  source: THREE.Mesh
  positions: Float32Array
  uv: Float32Array
  /** Width over height, in metres. */
  aspect: number
  /** Unit normal, facing the room. */
  normal: THREE.Vector3
  /** Frame of the piece: origin (u = v = 0) and the world length of one unit of u and of v. */
  origin: THREE.Vector3
  u: THREE.Vector3
  v: THREE.Vector3
}

const UP = new THREE.Vector3(0, 1, 0)
const WELD = 1e3 // vertices closer than a millimetre are the same

/** World-space triangles of a mesh, three vertices each (an index is unrolled). */
function worldTriangles(mesh: THREE.Mesh): Float32Array {
  const geometry = mesh.geometry
  const pos = geometry.getAttribute("position")
  const index = geometry.index
  const count = index ? index.count : pos.count
  const out = new Float32Array(count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld)
    out[i * 3] = v.x
    out[i * 3 + 1] = v.y
    out[i * 3 + 2] = v.z
  }
  return out
}

/** Triangles grouped by shared (welded) vertices: one group per connected piece. */
function connectedPieces(tri: Float32Array): number[][] {
  const n = tri.length / 9
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const owner = new Map<string, number>()
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 3; k++) {
      const o = (t * 3 + k) * 3
      const key = `${Math.round(tri[o] * WELD)},${Math.round(tri[o + 1] * WELD)},${Math.round(tri[o + 2] * WELD)}`
      const other = owner.get(key)
      if (other === undefined) owner.set(key, t)
      else parent[find(t)] = find(other)
    }
  }
  const groups = new Map<number, number[]>()
  for (let t = 0; t < n; t++) {
    const root = find(t)
    const g = groups.get(root)
    if (g) g.push(t)
    else groups.set(root, [t])
  }
  return [...groups.values()]
}

/** The flat pieces of the screens: meshes whose material is one of `materials`. */
export function findScreenPieces(root: THREE.Object3D, materials: readonly string[]) {
  const screens: THREE.Mesh[] = []
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    const name = (mesh.material as THREE.Material | undefined)?.name
    if (mesh.isMesh && name && materials.includes(name)) screens.push(mesh)
  })
  const pieces: ScreenPiece[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (const source of screens) {
    const tri = worldTriangles(source)
    for (const group of connectedPieces(tri)) {
      // the side the faces show, weighted by their area
      const normal = new THREE.Vector3()
      for (const t of group) {
        a.fromArray(tri, t * 9)
        b.fromArray(tri, t * 9 + 3)
        c.fromArray(tri, t * 9 + 6)
        normal.add(b.sub(a).cross(c.sub(a)))
      }
      if (normal.lengthSq() === 0) continue
      normal.normalize()
      if (Math.abs(normal.y) > 0.9) continue // a horizontal face is not a screen
      const u = new THREE.Vector3().crossVectors(UP, normal).normalize()
      const v = new THREE.Vector3().crossVectors(normal, u)
      let minU = Infinity
      let maxU = -Infinity
      let minV = Infinity
      let maxV = -Infinity
      for (const t of group) {
        for (let k = 0; k < 3; k++) {
          a.fromArray(tri, t * 9 + k * 3)
          minU = Math.min(minU, a.dot(u))
          maxU = Math.max(maxU, a.dot(u))
          minV = Math.min(minV, a.dot(v))
          maxV = Math.max(maxV, a.dot(v))
        }
      }
      const width = maxU - minU
      const height = maxV - minV
      if (width <= 0 || height <= 0) continue
      const positions = new Float32Array(group.length * 9)
      const uv = new Float32Array(group.length * 6)
      group.forEach((t, i) => {
        positions.set(tri.subarray(t * 9, t * 9 + 9), i * 9)
        for (let k = 0; k < 3; k++) {
          a.fromArray(tri, t * 9 + k * 3)
          uv[i * 6 + k * 2] = (a.dot(u) - minU) / width
          uv[i * 6 + k * 2 + 1] = (a.dot(v) - minV) / height
        }
      })
      const origin = u.clone().multiplyScalar(minU).add(v.clone().multiplyScalar(minV))
      // the plane's offset along the normal, taken from the first vertex
      origin.add(normal.clone().multiplyScalar(a.fromArray(tri, group[0] * 9).dot(normal)))
      pieces.push({
        source,
        positions,
        uv,
        aspect: width / height,
        normal,
        origin,
        u: u.multiplyScalar(width),
        v: v.multiplyScalar(height),
      })
    }
  }
  return { screens, pieces }
}

/**
 * Where a point stands on a piece: its (u, v) and its distance in front of the screen (m).
 * Used to find the text that stands on a screen.
 */
export function onPiece(piece: ScreenPiece, p: THREE.Vector3): { u: number; v: number; d: number } {
  const rel = p.clone().sub(piece.origin)
  return {
    u: rel.dot(piece.u) / piece.u.lengthSq(),
    v: rel.dot(piece.v) / piece.v.lengthSq(),
    d: rel.dot(piece.normal),
  }
}

/**
 * The triangles of `mesh` that stand on a screen: inside a piece's outline (a margin keeps its
 * frame out) and at most `depth` metres in front of it. Returns their indices in triangle order.
 */
export function trianglesOnScreens(
  mesh: THREE.Mesh,
  pieces: readonly ScreenPiece[],
  { margin = 0.04, depth = 0.6 } = {},
): number[] {
  const tri = worldTriangles(mesh)
  const centre = new THREE.Vector3()
  const on: number[] = []
  for (let t = 0; t < tri.length / 9; t++) {
    centre.set(
      (tri[t * 9] + tri[t * 9 + 3] + tri[t * 9 + 6]) / 3,
      (tri[t * 9 + 1] + tri[t * 9 + 4] + tri[t * 9 + 7]) / 3,
      (tri[t * 9 + 2] + tri[t * 9 + 5] + tri[t * 9 + 8]) / 3,
    )
    for (const piece of pieces) {
      const { u, v, d } = onPiece(piece, centre)
      if (u > margin && u < 1 - margin && v > margin && v < 1 - margin && d > -0.05 && d < depth) {
        on.push(t)
        break
      }
    }
  }
  return on
}

/** The video whose shape is closest to the piece's (aspect ratios compared on a log scale). */
export function pickVideo(aspect: number, videoAspects: readonly number[]): number {
  let best = 0
  for (let i = 1; i < videoAspects.length; i++) {
    if (
      Math.abs(Math.log(aspect / videoAspects[i])) < Math.abs(Math.log(aspect / videoAspects[best]))
    )
      best = i
  }
  return best
}

/** UVs that fill the piece with the video, cropping what overflows (like `object-fit: cover`). */
export function coverUv(uv: Float32Array, aspect: number, videoAspect: number): Float32Array {
  const out = new Float32Array(uv.length)
  const wider = aspect > videoAspect
  const k = wider ? videoAspect / aspect : aspect / videoAspect
  for (let i = 0; i < uv.length; i += 2) {
    out[i] = wider ? uv[i] : 0.5 + (uv[i] - 0.5) * k
    out[i + 1] = wider ? 0.5 + (uv[i + 1] - 0.5) * k : uv[i + 1]
  }
  return out
}
