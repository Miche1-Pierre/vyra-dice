import { describe, expect, it } from "vitest"

import { createDemoSink } from "@/server/requests/demo-sink"
import type { BookingRequestRecord } from "@/server/requests/sink"

function record(idempotencyKey: string, requestId: string): BookingRequestRecord {
  return {
    clubSlug: "demo",
    eventSlug: "samedi",
    tableId: "v1",
    fullName: "Camille Martin",
    phone: "06 12 34 56 78",
    partySize: 6,
    arrivalTime: "00:00",
    consent: true,
    idempotencyKey,
    requestId,
    createdAt: "2026-10-10T21:00:00.000Z",
    status: "received",
    transmission: "not_sent_demo",
    quote: { minimumSpend: 700, deposit: null },
  }
}

describe("createDemoSink", () => {
  it("returns the first request id when an idempotency key is replayed", async () => {
    const sink = createDemoSink()
    expect(await sink.save(record("key-1", "DEM-AAAAA"))).toEqual({
      requestId: "DEM-AAAAA",
      duplicate: false,
    })
    expect(await sink.save(record("key-1", "DEM-BBBBB"))).toEqual({
      requestId: "DEM-AAAAA",
      duplicate: true,
    })
  })

  it("keeps distinct keys apart", async () => {
    const sink = createDemoSink()
    await sink.save(record("key-1", "DEM-AAAAA"))
    expect(await sink.save(record("key-2", "DEM-BBBBB"))).toEqual({
      requestId: "DEM-BBBBB",
      duplicate: false,
    })
  })

  it("does not share state between sinks", async () => {
    await createDemoSink().save(record("key-1", "DEM-AAAAA"))
    expect((await createDemoSink().save(record("key-1", "DEM-BBBBB"))).duplicate).toBe(false)
  })

  it("forgets the oldest keys beyond its capacity", async () => {
    const sink = createDemoSink({ maxEntries: 2 })
    await sink.save(record("key-1", "DEM-AAAAA"))
    await sink.save(record("key-2", "DEM-BBBBB"))
    await sink.save(record("key-3", "DEM-CCCCC"))
    expect(await sink.save(record("key-3", "DEM-DDDDD"))).toEqual({
      requestId: "DEM-CCCCC",
      duplicate: true,
    })
    expect(await sink.save(record("key-1", "DEM-EEEEE"))).toEqual({
      requestId: "DEM-EEEEE",
      duplicate: false,
    })
  })
})
