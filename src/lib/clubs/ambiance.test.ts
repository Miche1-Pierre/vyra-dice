import { describe, expect, it } from "vitest"

import { ambianceSchema, finishOf, type ClubAmbiance } from "@/lib/clubs/ambiance"
import { showGlsl } from "@/components/scene/fx/show"

const finishes: ClubAmbiance["finishes"] = {
  floor: "glazed-tiles",
  rail: { preset: "brushed-metal", roughness: 0.4 },
}

describe("finishOf", () => {
  it("normalises a preset name and keeps the club's adjustments", () => {
    expect(finishOf(finishes, "floor")).toEqual({ preset: "glazed-tiles" })
    expect(finishOf(finishes, "rail")).toEqual({ preset: "brushed-metal", roughness: 0.4 })
  })

  it("is null for materials the club does not list, including prototype keys", () => {
    for (const name of ["wall", "constructor", "__proto__", "toString"]) {
      expect(finishOf(finishes, name), name).toBeNull()
    }
  })
})

describe("ambianceSchema", () => {
  const ambiance = (): ClubAmbiance => ({
    show: {
      bpm: 124,
      palette: [
        [1, 0.8, 0.6],
        [0.2, 0.4, 1],
      ],
    },
    beams: { palettes: [["#ffffff", "#ff3d9a"]] },
    environment: {
      background: "#040306",
      lightformers: [
        { form: "rect", color: "#ffffff", intensity: 1, position: [0, 9, 0], scale: 4 },
      ],
    },
    finishes: structuredClone(finishes),
    intro: "flight",
  })

  it("accepts a club without LED rain nor screen", () => {
    expect(ambianceSchema.safeParse(ambiance()).success).toBe(true)
  })

  it("rejects unknown presets, CSS colours other than #rrggbb and one-colour shows", () => {
    const bad = (patch: (a: ClubAmbiance) => void) => {
      const a = ambiance()
      patch(a)
      return ambianceSchema.safeParse(a).success
    }
    expect(bad((a) => (a.finishes.floor = "chrome" as never))).toBe(false)
    expect(bad((a) => (a.environment.background = "black"))).toBe(false)
    expect(bad((a) => (a.show.palette = [[1, 1, 1]]))).toBe(false)
  })

  it("opens with the flight and offers no night mode unless the club asks", () => {
    const { show, beams, environment, finishes } = ambiance()
    const plain = { show, beams, environment, finishes }
    const parsed = ambianceSchema.parse(plain)
    expect(parsed.intro).toBe("flight")
    expect(parsed.night).toBeUndefined()
    const neon = ambianceSchema.parse({ ...plain, intro: "neon", night: { color: "#ff1a2a" } })
    expect(neon).toMatchObject({ intro: "neon", night: { color: "#ff1a2a" } })
    expect(ambianceSchema.safeParse({ ...plain, night: { color: "red" } }).success).toBe(false)
  })
})

describe("showGlsl", () => {
  it("compiles the club's tempo and palette into the shader", () => {
    const glsl = showGlsl({
      bpm: 128,
      palette: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    })
    expect(glsl).toContain("t * 128.0 / 60.0")
    expect(glsl).toContain("fract(t) * 3.0")
    expect(glsl).toContain("if (i == 1) return vec3(0, 1, 0);")
    expect(glsl).toContain("return vec3(0, 0, 1);")
    expect(glsl).toContain("i == 2 ? 0 : i + 1")
  })
})
