import { describe, expect, it } from "vitest"

import { createRequestId, isRequestId } from "@/lib/request-id"

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

describe("createRequestId", () => {
  it("builds PREFIX-XXXXX with Crockford base32 characters", () => {
    const id = createRequestId("NHO")
    expect(id).toMatch(/^NHO-[0-9A-HJKMNP-TV-Z]{5}$/)
    expect(id.slice(4)).not.toMatch(/[ILOU]/)
  })

  it("does not repeat itself", () => {
    const ids = Array.from({ length: 1000 }, () => createRequestId("NHO"))
    // 1000 draws among 32^5 ids: P(any collision) ≈ 1.5 %, P(more than two) < 1e-6.
    // Asserting strict uniqueness would make this test flaky.
    expect(new Set(ids).size).toBeGreaterThanOrEqual(998)
  })

  it("uses the whole alphabet", () => {
    const suffixes = Array.from({ length: 1000 }, () => createRequestId("NHO").slice(4)).join("")
    expect(new Set(suffixes)).toEqual(new Set(CROCKFORD))
  })

  it("only accepts three uppercase letters as prefix", () => {
    expect(() => createRequestId("nho")).toThrow(RangeError)
    expect(() => createRequestId("NH")).toThrow(RangeError)
  })
})

describe("isRequestId", () => {
  it("recognises generated ids", () => {
    const id = createRequestId("NHO")
    expect(isRequestId(id)).toBe(true)
    expect(isRequestId(id, "NHO")).toBe(true)
    expect(isRequestId(id, "VYR")).toBe(false)
  })

  it("rejects malformed ids", () => {
    for (const value of [
      "",
      "NHO-7K2Q",
      "NHO-7K2QF1",
      "nho-7k2qf",
      "NHO-7K2QI",
      "NHO7K2QF",
      " NHO-7K2QF",
    ]) {
      expect(isRequestId(value), value).toBe(false)
    }
  })
})
