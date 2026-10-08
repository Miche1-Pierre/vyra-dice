import { describe, expect, it } from "vitest"

import { createRequestId, isRequestId } from "@/lib/request-id"

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

describe("createRequestId", () => {
  it("builds PREFIX-XXXXX with Crockford base32 characters", () => {
    const id = createRequestId("DEM")
    expect(id).toMatch(/^DEM-[0-9A-HJKMNP-TV-Z]{5}$/)
    expect(id.slice(4)).not.toMatch(/[ILOU]/)
  })

  it("does not repeat itself", () => {
    const ids = Array.from({ length: 1000 }, () => createRequestId("DEM"))
    // 1000 draws among 32^5 ids: P(any collision) ≈ 1.5 %, P(more than two) < 1e-6.
    // Asserting strict uniqueness would make this test flaky.
    expect(new Set(ids).size).toBeGreaterThanOrEqual(998)
  })

  it("uses the whole alphabet", () => {
    const suffixes = Array.from({ length: 1000 }, () => createRequestId("DEM").slice(4)).join("")
    expect(new Set(suffixes)).toEqual(new Set(CROCKFORD))
  })

  it("only accepts three uppercase letters as prefix", () => {
    expect(() => createRequestId("dem")).toThrow(RangeError)
    expect(() => createRequestId("DE")).toThrow(RangeError)
  })
})

describe("isRequestId", () => {
  it("recognises generated ids", () => {
    const id = createRequestId("DEM")
    expect(isRequestId(id)).toBe(true)
    expect(isRequestId(id, "DEM")).toBe(true)
    expect(isRequestId(id, "VYR")).toBe(false)
  })

  it("rejects malformed ids", () => {
    for (const value of [
      "",
      "DEM-7K2Q",
      "DEM-7K2QF1",
      "dem-7k2qf",
      "DEM-7K2QI",
      "DEM7K2QF",
      " DEM-7K2QF",
    ]) {
      expect(isRequestId(value), value).toBe(false)
    }
  })
})
