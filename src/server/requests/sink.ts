import type { BookingRequestInput } from "@/lib/schema"

// Server code only. The `server-only` guard package is not installed: never import `src/server/**`
// from a client component.

/** What happened to the request after it was received. */
export type RequestTransmission = "not_sent_demo" | "pending" | "sent" | "failed"

/** A validated booking request, as handed to a sink. */
export type BookingRequestRecord = BookingRequestInput & {
  requestId: string
  /** Reception time, ISO 8601 (UTC). */
  createdAt: string
  status: "received"
  transmission: RequestTransmission
  /** Figures shown to the buyer for this group when the request was sent. */
  quote: { minimumSpend: number | null; deposit: number | null }
}

export interface RequestSink {
  /**
   * Stores a request. Idempotent on `idempotencyKey`: replaying a key stores nothing new and
   * returns the first request's id with `duplicate: true`. Implementations keep `requestId` unique.
   */
  save(record: BookingRequestRecord): Promise<{ requestId: string; duplicate: boolean }>
}
