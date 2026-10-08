import { describe, expect, it } from "vitest"

import { createRateLimiter } from "@/server/requests/rate-limit"

const MINUTE = 60 * 1000

describe("createRateLimiter", () => {
  it("allows `limit` attempts per window, then tells when to retry", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 10 * MINUTE })
    const start = 1_000_000
    expect(limiter.check("ip", start)).toEqual({ allowed: true, retryAfterMs: 0 })
    expect(limiter.check("ip", start + 1 * MINUTE).allowed).toBe(true)
    expect(limiter.check("ip", start + 2 * MINUTE).allowed).toBe(true)
    expect(limiter.check("ip", start + 3 * MINUTE)).toEqual({
      allowed: false,
      retryAfterMs: 7 * MINUTE,
    })
  })

  it("slides: each attempt frees its slot one window later", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 10 * MINUTE })
    limiter.check("ip", 0)
    limiter.check("ip", 4 * MINUTE)
    expect(limiter.check("ip", 9 * MINUTE).allowed).toBe(false)
    // The first attempt leaves the window at 10 min, the second one at 14 min.
    expect(limiter.check("ip", 10 * MINUTE).allowed).toBe(true)
    expect(limiter.check("ip", 11 * MINUTE)).toEqual({ allowed: false, retryAfterMs: 3 * MINUTE })
    expect(limiter.check("ip", 14 * MINUTE).allowed).toBe(true)
  })

  it("does not count refused attempts", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MINUTE })
    limiter.check("ip", 0)
    for (let t = 1; t < 60; t++) expect(limiter.check("ip", t * 1000).allowed).toBe(false)
    expect(limiter.check("ip", MINUTE).allowed).toBe(true)
  })

  it("limits each key separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MINUTE })
    expect(limiter.check("demo:1.2.3.4", 0).allowed).toBe(true)
    expect(limiter.check("demo:1.2.3.4", 1).allowed).toBe(false)
    expect(limiter.check("demo:5.6.7.8", 1).allowed).toBe(true)
  })

  it("defaults to 5 attempts per 10 minutes", () => {
    const limiter = createRateLimiter()
    for (let i = 0; i < 5; i++) expect(limiter.check("ip", i).allowed).toBe(true)
    expect(limiter.check("ip", 5)).toEqual({ allowed: false, retryAfterMs: 10 * MINUTE - 5 })
    expect(limiter.check("ip", 10 * MINUTE).allowed).toBe(true)
  })

  it("rejects invalid options", () => {
    expect(() => createRateLimiter({ limit: 0 })).toThrow(RangeError)
    expect(() => createRateLimiter({ windowMs: 0 })).toThrow(RangeError)
  })
})
