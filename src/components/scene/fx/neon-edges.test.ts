import { describe, expect, it } from "vitest"

import { computeNeonEdges } from "@/components/scene/fx/neon-edges"

// unit cube, outward-facing triangles
const corners = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]
const faces = [
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6,
  1, 6, 5,
]
const cube = { positions: new Float32Array(corners), index: new Uint32Array(faces) }

describe("computeNeonEdges", () => {
  it("draws the twelve edges of a cube, not the diagonals of its faces", () => {
    const edges = computeNeonEdges({
      meshes: [cube],
      thresholdDeg: 30,
      origin: [0, 0, 0],
      reach: 2,
      height: 1,
    })
    expect(edges.positions.length / 6).toBe(12)
    for (let s = 0; s < edges.seg.length; s += 2) {
      expect([edges.seg[s], edges.seg[s + 1]]).toEqual([0, 1])
      expect(edges.delay[s]).toBe(edges.delay[s + 1])
    }
  })

  it("outlines a flat panel, without its diagonal", () => {
    // two triangles, unindexed
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1])
    const edges = computeNeonEdges({
      meshes: [{ positions, index: null }],
      thresholdDeg: 30,
      origin: [0, 0, 0],
      reach: 2,
      height: 1,
    })
    expect(edges.positions.length / 6).toBe(4)
  })

  it("draws from the centre and the floor out to the far, high edges", () => {
    const edges = computeNeonEdges({
      meshes: [cube],
      thresholdDeg: 30,
      origin: [0, 0, 0],
      reach: 2,
      height: 1,
    })
    const delays = Array.from(edges.delay)
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...delays)).toBeLessThanOrEqual(1)
    // the edge along x at the origin's corner starts before the opposite top edge
    const at = (x: number, y: number, z: number) => {
      for (let s = 0; s < edges.positions.length / 3; s += 2) {
        const p = edges.positions
        const mid = [
          (p[s * 3] + p[s * 3 + 3]) / 2,
          (p[s * 3 + 1] + p[s * 3 + 4]) / 2,
          (p[s * 3 + 2] + p[s * 3 + 5]) / 2,
        ]
        if (mid[0] === x && mid[1] === y && mid[2] === z) return edges.delay[s]
      }
      throw new Error("no such edge")
    }
    expect(at(0.5, 0, 0)).toBeLessThan(at(0.5, 1, 1))
  })
})
