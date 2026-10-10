import * as THREE from "three"
import { describe, expect, it } from "vitest"

import {
  coverUv,
  findScreenPieces,
  pickVideo,
  trianglesOnScreens,
} from "@/components/scene/fx/screens"

/** A vertical quad `width` × `height` around the origin, facing +z, turned by `yaw`. */
function quad(width: number, height: number, material: string, yaw = 0) {
  const geometry = new THREE.PlaneGeometry(width, height)
  geometry.translate(0, height / 2, 0)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ name: material }))
  mesh.rotation.y = yaw
  return mesh
}

/** The UV of the piece's vertex closest to `p`. */
function uvAt(piece: ReturnType<typeof findScreenPieces>["pieces"][number], p: THREE.Vector3) {
  let best = 0
  let dist = Infinity
  for (let i = 0; i < piece.positions.length / 3; i++) {
    const d = p.distanceTo(new THREE.Vector3().fromArray(piece.positions, i * 3))
    if (d < dist) {
      dist = d
      best = i
    }
  }
  return [piece.uv[best * 2], piece.uv[best * 2 + 1]]
}

describe("findScreenPieces", () => {
  it("frames a screen left to right as seen from the front, bottom to top", () => {
    const root = new THREE.Group()
    root.add(quad(4, 1, "screen"))
    const { pieces } = findScreenPieces(root, ["screen"])
    expect(pieces).toHaveLength(1)
    expect(pieces[0].aspect).toBeCloseTo(4)
    expect(uvAt(pieces[0], new THREE.Vector3(-2, 0, 0))).toEqual([0, 0])
    expect(uvAt(pieces[0], new THREE.Vector3(2, 1, 0))).toEqual([1, 1])
  })

  it("keeps the picture the right way round on a screen facing the other way", () => {
    const root = new THREE.Group()
    root.add(quad(4, 1, "screen", Math.PI))
    const { pieces } = findScreenPieces(root, ["screen"])
    // seen from -z, the viewer's left is +x
    expect(uvAt(pieces[0], new THREE.Vector3(2, 0, 0))[0]).toBeCloseTo(0)
    expect(uvAt(pieces[0], new THREE.Vector3(-2, 0, 0))[0]).toBeCloseTo(1)
  })

  it("splits a mesh into its separate screens and leaves other materials and floors out", () => {
    const root = new THREE.Group()
    const a = quad(1, 3, "screen")
    const b = quad(1, 3, "screen")
    b.position.x = 5
    const merged = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ name: "screen" }),
    )
    a.updateMatrix()
    b.updateMatrix()
    const ga = a.geometry.clone().applyMatrix4(a.matrix).toNonIndexed()
    const gb = b.geometry.clone().applyMatrix4(b.matrix).toNonIndexed()
    merged.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([
          ...ga.getAttribute("position").array,
          ...gb.getAttribute("position").array,
        ]),
        3,
      ),
    )
    const floor = quad(10, 10, "screen")
    floor.rotation.x = -Math.PI / 2
    root.add(merged, floor, quad(2, 2, "wall"))
    const { pieces } = findScreenPieces(root, ["screen"])
    expect(pieces).toHaveLength(2)
    expect(pieces.every((p) => Math.abs(p.aspect - 1 / 3) < 1e-6)).toBe(true)
  })
})

describe("trianglesOnScreens", () => {
  it("finds the text standing on a screen, not its frame nor what stands elsewhere", () => {
    const root = new THREE.Group()
    root.add(quad(4, 2, "screen"))
    const { pieces } = findScreenPieces(root, ["screen"])
    const text = new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([
            // on the screen, 10 cm in front of it
            -0.2, 0.9, 0.1, 0.2, 0.9, 0.1, 0, 1.1, 0.1,
            // on its frame (left edge)
            -2.02, 0.9, 0.01, -1.98, 0.9, 0.01, -2, 1.1, 0.01,
            // far in front of it
            -0.2, 0.9, 3, 0.2, 0.9, 3, 0, 1.1, 3,
          ]),
          3,
        ),
      ),
    )
    expect(trianglesOnScreens(text, pieces)).toEqual([0])
  })
})

describe("pickVideo and coverUv", () => {
  it("plays on each screen the loop closest to its shape", () => {
    const loops = [16 / 9, 8.3, 1 / 3]
    expect(pickVideo(6 / 3.4, loops)).toBe(0)
    expect(pickVideo(10 / 1.2, loops)).toBe(1)
    expect(pickVideo(1 / 3, loops)).toBe(2)
  })

  it("fills the screen and crops what overflows, keeping the middle", () => {
    const uv = new Float32Array([0, 0, 1, 1])
    // a screen twice as wide as the video: the video's middle half (in height) fills it
    expect([...coverUv(uv, 2, 1)]).toEqual([0, 0.25, 1, 0.75])
    // a screen half as wide: the video's middle half (in width)
    expect([...coverUv(uv, 0.5, 1)]).toEqual([0.25, 0, 0.75, 1])
  })
})
