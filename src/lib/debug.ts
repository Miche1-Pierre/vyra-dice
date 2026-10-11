/*
 * On-device diagnostics, for a visit opened with `debug` in its address (`…#son=<key>&debug`), and
 * never otherwise: what the music, its audio context and the page go through on a phone we cannot
 * plug in (an iPhone without a Mac). Events are batched to /api/debug, where they land in the
 * server's logs. No personal data: event names, states, times, the browser's user agent.
 */

type Event = Record<string, unknown> & { t: number; event: string }

let active = false
let queue: Event[] = []
const startedAt = typeof performance === "undefined" ? 0 : performance.now()
const session = Math.random().toString(36).slice(2, 8)

/** The address asks for diagnostics (`#…&debug` or `#debug`). */
export function debugRequested(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.hash.slice(1)).has("debug")
}

/** Records an event when diagnostics are on (cheap no-op otherwise). */
export function debugLog(event: string, data?: Record<string, unknown>) {
  if (!active) return
  queue.push({ t: Math.round(performance.now() - startedAt), event, ...data })
  if (queue.length > 200) queue = queue.slice(-200)
}

function flush() {
  if (!queue.length) return
  const body = JSON.stringify({ session, events: queue })
  queue = []
  if (!navigator.sendBeacon?.("/api/debug", body)) {
    void fetch("/api/debug", { method: "POST", body, keepalive: true }).catch(() => undefined)
  }
}

/** Starts the diagnostics when the address asks for them; safe to call more than once. */
export function startDebug() {
  if (active || !debugRequested()) return
  active = true
  debugLog("start", {
    ua: navigator.userAgent,
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
  })
  window.setInterval(flush, 2000)
  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () =>
    debugLog("visibility", { state: document.visibilityState }),
  )
  window.addEventListener("error", (e) =>
    debugLog("error", { message: String(e.message).slice(0, 300) }),
  )
  window.addEventListener("unhandledrejection", (e) =>
    debugLog("rejection", { reason: String(e.reason).slice(0, 300) }),
  )
  const audioSession = (
    navigator as Navigator & {
      audioSession?: EventTarget & { state?: string; type?: string }
    }
  ).audioSession
  audioSession?.addEventListener("statechange", () =>
    debugLog("audio_session", { state: audioSession.state, type: audioSession.type }),
  )
}
