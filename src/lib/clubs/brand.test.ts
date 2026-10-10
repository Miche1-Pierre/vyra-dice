import { describe, expect, it } from "vitest"

import { brandCss, brandSchema, brandVars, type ClubBrand } from "@/lib/clubs/brand"

const brand = (): ClubBrand => ({
  accent: {
    name: "argent",
    color: "#c9ced6",
    deep: "#7d8591",
    on: "#101317",
    pill: ["#eef1f5", "#9aa2ad"],
    foil: ["#f4f6f8", "#c3c9d1", "#808a96"],
  },
  tiers: {
    lounge: { color: "#32d074", deep: "#0d5a33" },
    vip: { color: "#ff375f", deep: "#6b0f22" },
    prestige: { color: "#ffd60a", deep: "#6b5600" },
  },
  font: "jost",
  ui: { tone: "vivid", compare: true },
})

describe("brandSchema", () => {
  it("accepts a club without drawn wordmark nor emblem", () => {
    expect(brandSchema.safeParse(brand()).success).toBe(true)
  })

  it("speaks in the vivid tone and offers the comparison unless the club says otherwise", () => {
    const { accent, tiers, font } = brand()
    const plain = { accent, tiers, font }
    expect(brandSchema.parse(plain).ui).toEqual({ tone: "vivid", compare: true })
    expect(brandSchema.parse({ ...plain, ui: { tone: "sober", compare: false } }).ui).toEqual({
      tone: "sober",
      compare: false,
    })
    expect(brandSchema.safeParse({ ...plain, ui: { tone: "loud" } }).success).toBe(false)
  })

  it("only accepts #rrggbb colours, known fonts and plain path data", () => {
    const bad = (patch: (b: ClubBrand) => void) => {
      const b = brand()
      patch(b)
      return brandSchema.safeParse(b).success
    }
    expect(bad((b) => (b.accent.color = "red"))).toBe(false)
    expect(bad((b) => (b.accent.color = "#c9ced6;}body{display:none"))).toBe(false)
    expect(bad((b) => (b.font = "comic" as never))).toBe(false)
    expect(
      bad(
        (b) => (b.wordmark = { viewBox: [10, 10], strokeWidth: 1, strokes: ['M0 0"/><script>'] }),
      ),
    ).toBe(false)
  })
})

describe("brandCss", () => {
  it("sets the accent, the foil, the tier hues and the typeface on :root", () => {
    const css = brandCss(brand())
    expect(css.startsWith(":root{") && css.endsWith("}")).toBe(true)
    for (const declaration of [
      "--brand:#c9ced6",
      "--brand-deep:#7d8591",
      "--brand-on:#101317",
      "--brand-hi:#eef1f5",
      "--brand-lo:#9aa2ad",
      "--foil-hi:#f4f6f8",
      "--foil:#c3c9d1",
      "--foil-lo:#808a96",
      "--vip:#ff375f",
      "--vip-deep:#6b0f22",
      "--club-font:var(--font-jost)",
    ]) {
      expect(css).toContain(declaration)
    }
  })
})

describe("brandVars", () => {
  it("gives the same custom properties to style one element", () => {
    const vars = brandVars(brand())
    expect(vars["--brand"]).toBe("#c9ced6")
    expect(vars["--vip"]).toBe("#ff375f")
    const declarations = Object.entries(vars).map(([name, value]) => `${name}:${value}`)
    expect(brandCss(brand())).toBe(`:root{${declarations.join(";")}}`)
  })
})
