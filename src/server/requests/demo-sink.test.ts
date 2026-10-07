import { describe, expect, it } from "vitest"

import { createDemoSink } from "@/server/requests/demo-sink"
import type { BookingRequestRecord } from "@/server/requests/sink"

function record(idempotencyKey: string, requestId: string): BookingRequestRecord {
  return {
    clubSlug: "naho",
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
  }
}

describe("createDemoSink", () => {
  it("returns the first request id when an idempotency key is replayed", async () => {
    const sink = createDemoSink()
    expect(await sink.save(record("key-1", "NHO-AAAAA"))).toEqual({
      requestId: "NHO-AAAAA",
      duplicate: false,
    })
    expect(await sink.save(record("key-1", "NHO-BBBBB"))).toEqual({
      requestId: "NHO-AAAAA",
      duplicate: true,
    })
  })

  it("keeps distinct keys apart", async () => {
    const sink = createDemoSink()
    await sink.save(record("key-1", "NHO-AAAAA"))
    expect(await sink.save(record("key-2", "NHO-BBBBB"))).toEqual({
      requestId: "NHO-BBBBB",
      duplicate: false,
    })
  })

  it("does not share state between sinks", async () => {
    await createDemoSink().save(record("key-1", "NHO-AAAAA"))
    expect((await createDemoSink().save(record("key-1", "NHO-BBBBB"))).duplicate).toBe(false)
  })

  it("forgets the oldest keys beyond its capacity", async () => {
    const sink = createDemoSink({ maxEntries: 2 })
    await sink.save(record("key-1", "NHO-AAAAA"))
    await sink.save(record("key-2", "NHO-BBBBB"))
    await sink.save(record("key-3", "NHO-CCCCC"))
    expect(await sink.save(record("key-3", "NHO-DDDDD"))).toEqual({
      requestId: "NHO-CCCCC",
      duplicate: true,
    })
    expect(await sink.save(record("key-1", "NHO-EEEEE"))).toEqual({
      requestId: "NHO-EEEEE",
      duplicate: false,
    })
  })
})
