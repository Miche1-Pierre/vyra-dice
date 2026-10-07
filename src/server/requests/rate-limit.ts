export interface RateLimitResult {
  allowed: boolean
  /** Wait before the next attempt can succeed; 0 when allowed. */
  retryAfterMs: number
}

export interface RateLimiter {
  /** Records an attempt for `key` at `now` (ms) and tells whether it is allowed. */
  check(key: string, now?: number): RateLimitResult
}

/** Above this many tracked keys, keys with no hit in the current window are dropped. */
const SWEEP_THRESHOLD = 10_000

/**
 * In-memory sliding window: at most `limit` allowed attempts per key over the last `windowMs`
 * (default: 5 per 10 minutes). Refused attempts are not counted. State is per server instance:
 * it slows a script down, it is not a distributed quota.
 */
export function createRateLimiter({
  limit = 5,
  windowMs = 10 * 60 * 1000,
}: { limit?: number; windowMs?: number } = {}): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("limit must be a positive integer")
  }
  if (!(windowMs > 0)) throw new RangeError("windowMs must be positive")

  const hits = new Map<string, number[]>()

  return {
    check(key, now = Date.now()) {
      const windowStart = now - windowMs
      if (hits.size >= SWEEP_THRESHOLD) {
        for (const [trackedKey, times] of hits) {
          if (times[times.length - 1] <= windowStart) hits.delete(trackedKey)
        }
      }

      const recent = (hits.get(key) ?? []).filter((time) => time > windowStart)
      if (recent.length >= limit) {
        hits.set(key, recent)
        return { allowed: false, retryAfterMs: recent[0] + windowMs - now }
      }
      recent.push(now)
      hits.set(key, recent)
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}
