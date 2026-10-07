import type { RequestSink } from "@/server/requests/sink"

/**
 * In-memory sink for demo venues: requests are acknowledged but transmitted nowhere.
 *
 * Only the idempotency key → request id mapping is kept (no personal data), capped at
 * `maxEntries` with the oldest entries dropped first.
 */
export function createDemoSink({ maxEntries = 1000 }: { maxEntries?: number } = {}): RequestSink {
  const requestIds = new Map<string, string>()
  return {
    async save(record) {
      const existing = requestIds.get(record.idempotencyKey)
      if (existing !== undefined) return { requestId: existing, duplicate: true }

      requestIds.set(record.idempotencyKey, record.requestId)
      if (requestIds.size > maxEntries) {
        // Maps iterate in insertion order: the first key is the oldest.
        const oldest = requestIds.keys().next().value
        if (oldest !== undefined) requestIds.delete(oldest)
      }
      return { requestId: record.requestId, duplicate: false }
    },
  }
}

/** Demo sink of this server instance (emptied on restart). */
export const demoSink = createDemoSink()
