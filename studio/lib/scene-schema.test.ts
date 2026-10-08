import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { checkScene, sceneSchema } from "@studio/lib/scene-schema"

const naho = () => JSON.parse(readFileSync("clubs/naho/scene.json", "utf8"))

describe("sceneSchema", () => {
  it("accepts the Naho scene the generic builder reproduces", () => {
    expect(checkScene(naho())).toEqual([])
  })

  it("reports unknown material roles, element types and malformed operations", () => {
    const scene = naho()
    scene.elements[0].ops[0][6] = "marble_pink"
    expect(checkScene(scene).join("\n")).toMatch(/Unknown material role "marble_pink"/)

    const wrongType = naho()
    wrongType.elements.push({ type: "hologram" })
    expect(sceneSchema.safeParse(wrongType).success).toBe(false)

    const shortOp = naho()
    shortOp.elements[0].ops[0] = ["floor", "gx0", "gx1", "tiles"]
    expect(checkScene(shortOp).join("\n")).toMatch(/floor takes 6 arguments/)
  })

  it("only accepts expressions made of names, numbers and arithmetic", () => {
    const scene = naho()
    scene.elements[0].ops[0][1] = "__import__('os')"
    expect(checkScene(scene)).not.toEqual([])
  })
})
