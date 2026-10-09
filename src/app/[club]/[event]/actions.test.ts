import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { submitBookingRequest } from "@/app/[club]/[event]/actions"
import { isRequestId } from "@/lib/request-id"
import { demoSink } from "@/server/requests/demo-sink"

const client = vi.hoisted(() => ({ ip: "1.2.3.4" }))

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": `${client.ip}, 10.0.0.1` }),
}))

// a fictional club: the action must not depend on the clubs actually registered
vi.mock("@/lib/clubs/registry", async () => {
  const { demoVenue } = await import("@/test/fixtures")
  return {
    getVenueContent: (club: string, event: string) =>
      club === demoVenue.club.slug && event === demoVenue.event.slug ? demoVenue : null,
  }
})

function request(overrides: Record<string, unknown> = {}) {
  return {
    clubSlug: "demo",
    eventSlug: "samedi",
    tableId: "v2",
    fullName: "Camille Martin",
    phone: "06 12 34 56 78",
    email: "camille@example.com",
    partySize: 6,
    arrivalTime: "00:00",
    consent: true,
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  }
}

// Each test comes from its own address so the shared rate limiter never interferes.
let clientCount = 0
beforeEach(() => {
  clientCount += 1
  client.ip = `203.0.113.${clientCount}`
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("submitBookingRequest", () => {
  it("acknowledges a valid demo request with a club request id", async () => {
    const result = await submitBookingRequest(request())
    expect(result).toMatchObject({ ok: true, demo: true, duplicate: false })
    expect(result.ok && isRequestId(result.requestId, "DEM")).toBe(true)
  })

  it("returns the same id when the same request is sent twice", async () => {
    const input = request()
    const first = await submitBookingRequest(input)
    const second = await submitBookingRequest(input)
    expect(first).toMatchObject({ ok: true, duplicate: false })
    expect(second).toEqual({ ...first, duplicate: true })
  })

  it("refuses a sold table", async () => {
    expect(await submitBookingRequest(request({ tableId: "l2" }))).toEqual({
      ok: false,
      error: "unavailable",
    })
  })

  it("refuses a group outside the table's capacity", async () => {
    const tooMany = { partySize: "Cette table accueille de 6 à 8 personnes" }
    for (const partySize of [9, 2]) {
      expect(await submitBookingRequest(request({ tableId: "v2", partySize }))).toEqual({
        ok: false,
        error: "validation",
        fieldErrors: tooMany,
      })
    }
  })

  it("keeps the figures shown to the buyer with the request", async () => {
    const save = vi.spyOn(demoSink, "save")
    await submitBookingRequest(request({ tableId: "l1", partySize: 5 }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ partySize: 5, quote: { minimumSpend: 350, deposit: null } }),
    )
    await submitBookingRequest(request({ tableId: "v2", partySize: 6 }))
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ quote: { minimumSpend: null, deposit: null } }),
    )
  })

  it("accepts a table on request", async () => {
    expect(await submitBookingRequest(request({ tableId: "v1" }))).toMatchObject({ ok: true })
  })

  it("reports unknown tables and venues", async () => {
    const unknownTable = { ok: false, error: "unknown_table" }
    expect(await submitBookingRequest(request({ tableId: "z9" }))).toEqual(unknownTable)
    expect(await submitBookingRequest(request({ eventSlug: "dimanche" }))).toEqual(unknownTable)
  })

  it("returns French field errors for an invalid form", async () => {
    const result = await submitBookingRequest(request({ phone: "12", consent: false }))
    expect(result).toEqual({
      ok: false,
      error: "validation",
      fieldErrors: {
        phone: "Numéro invalide (ex. 06 12 34 56 78)",
        consent: "Merci d'accepter d'être recontacté par le club",
      },
    })
    expect(await submitBookingRequest(null)).toEqual({
      ok: false,
      error: "validation",
      fieldErrors: { form: "Demande invalide" },
    })
  })

  it("rate-limits by client address and club", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await submitBookingRequest(request()), `request ${i + 1}`).toMatchObject({ ok: true })
    }
    expect(await submitBookingRequest(request())).toEqual({ ok: false, error: "rate_limited" })

    client.ip = "198.51.100.7"
    expect(await submitBookingRequest(request())).toMatchObject({ ok: true })
  })

  it("hides unexpected errors and never logs personal data", async () => {
    vi.spyOn(demoSink, "save").mockRejectedValueOnce(new Error("disk full"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(await submitBookingRequest(request())).toEqual({ ok: false, error: "server" })
    expect(log).toHaveBeenCalled()
    const logged = JSON.stringify(log.mock.calls)
    for (const secret of ["Camille", "06 12 34 56 78", "camille@example.com"]) {
      expect(logged).not.toContain(secret)
    }
  })

  it("does not acknowledge requests for a live club without a sink", async () => {
    vi.resetModules()
    vi.doMock("@/lib/clubs/registry", async () => {
      const { demoVenue } = await import("@/test/fixtures")
      return { getVenueContent: () => ({ ...demoVenue, club: { ...demoVenue.club, demo: false } }) }
    })
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const { submitBookingRequest: submitLive } = await import("@/app/[club]/[event]/actions")
      expect(await submitLive(request())).toEqual({ ok: false, error: "server" })
      expect(log).toHaveBeenCalled()
    } finally {
      vi.doUnmock("@/lib/clubs/registry")
      vi.resetModules()
    }
  })
})
