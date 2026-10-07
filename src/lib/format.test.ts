import { describe, expect, it } from "vitest"

import { formatCapacity, formatDateFr, formatEuro } from "@/lib/format"

/** Intl separates groups and the currency with no-break spaces; compare with plain spaces. */
const plain = (text: string) => text.replace(/\s/g, " ")

describe("formatEuro", () => {
  it("formats whole euros the French way", () => {
    const formatted = formatEuro(1000)
    expect(formatted).toContain("1")
    expect(formatted).toContain("000")
    expect(formatted).toContain("€")
    expect(plain(formatted)).toBe("1 000 €")
    expect(plain(formatEuro(350))).toBe("350 €")
    expect(plain(formatEuro(2500))).toBe("2 500 €")
  })

  it("keeps the line from breaking inside an amount", () => {
    expect(formatEuro(1000)).not.toContain(" ")
  })

  it("rounds to the euro", () => {
    expect(plain(formatEuro(87.5))).toBe("88 €")
  })
})

describe("formatCapacity", () => {
  it("shows a range of guests", () => {
    expect(formatCapacity({ min: 4, max: 6 })).toBe("4–6 pers.")
  })

  it("shows a single number for a fixed capacity", () => {
    expect(formatCapacity({ min: 6, max: 6 })).toBe("6 pers.")
  })
})

describe("formatDateFr", () => {
  it("formats an ISO date as a French day", () => {
    expect(formatDateFr("2026-10-10")).toBe("samedi 10 octobre")
  })

  it("writes the first of the month as 1er", () => {
    expect(formatDateFr("2026-11-01")).toBe("dimanche 1er novembre")
  })

  it("does not shift the day with the local time zone", () => {
    expect(formatDateFr("2026-12-31")).toBe("jeudi 31 décembre")
  })

  it("rejects malformed or impossible dates", () => {
    expect(() => formatDateFr("10/10/2026")).toThrow(RangeError)
    expect(() => formatDateFr("2026-02-30")).toThrow(RangeError)
  })
})
