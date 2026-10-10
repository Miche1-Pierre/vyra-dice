import { describe, expect, it } from "vitest"

import { surfaceImages } from "@/components/scene/fx/surface-fields"

const meanBlue = (rgba: Uint8ClampedArray) => {
  let sum = 0
  for (let i = 2; i < rgba.length; i += 4) sum += rgba[i]
  return sum / (rgba.length / 4)
}

describe("surfaceImages", () => {
  it("gives opaque RGBA images of the surface's size, the same on every run", () => {
    const [velvet] = surfaceImages({ kind: "velvet" })
    expect(velvet).toHaveLength(256 * 256 * 4)
    expect(velvet.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true)
    expect(surfaceImages({ kind: "velvet" })[0]).toEqual(velvet)
  })

  it("makes normal maps that face out of the surface", () => {
    for (const kind of ["velvet", "leather", "brushed"] as const) {
      expect(meanBlue(surfaceImages({ kind })[0])).toBeGreaterThan(200)
    }
  })

  it("gives the marble a dark albedo with lighter veins, and its roughness", () => {
    const [albedo, roughness] = surfaceImages({ kind: "marble", size: 64 })
    expect(albedo).toHaveLength(64 * 64 * 4)
    expect(roughness).toHaveLength(64 * 64 * 4)
    const red = albedo.filter((_, i) => i % 4 === 0)
    expect(Math.min(...red)).toBeLessThan(20)
    expect(Math.max(...red)).toBeGreaterThan(100)
  })

  it("derives no relief from a flat albedo, and its roughness from the albedo's pixels", () => {
    const size = 16
    const pixels = new Uint8ClampedArray(size * size * 4).fill(128)
    const [normal] = surfaceImages({ kind: "albedo-normal", size, strength: 2, pixels })
    expect([...normal.slice(0, 4)]).toEqual([128, 128, 255, 255])
    expect(meanBlue(normal)).toBe(255)
    const [rough] = surfaceImages({ kind: "albedo-roughness", size, lo: 0.1, hi: 0.6, pixels })
    expect(rough).toHaveLength(size * size * 4)
  })
})
