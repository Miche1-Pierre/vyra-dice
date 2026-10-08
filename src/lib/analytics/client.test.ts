import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  set_config: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  has_opted_in_capturing: vi.fn(() => false),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}))

vi.mock("posthog-js", () => ({ default: posthog }))

const venue = { club: "demo", event: "samedi", demo: true }

function fakeWindow({ search = "", consent }: { search?: string; consent?: string } = {}) {
  const store = new Map<string, string>(consent ? [["vyra-consent", consent]] : [])
  return {
    location: { search },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  }
}

/** Fresh module state (consent, queue, init flag) for each test. */
async function loadClient(win: ReturnType<typeof fakeWindow> = fakeWindow()) {
  vi.resetModules()
  vi.stubGlobal("window", win)
  return import("@/lib/analytics/client")
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test")
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("initAnalytics", () => {
  it("starts PostHog without cookies, autocapture, page views or replay", async () => {
    const analytics = await loadClient()
    analytics.initAnalytics(venue)
    expect(posthog.init).toHaveBeenCalledOnce()
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        persistence: "memory",
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        opt_out_capturing_by_default: true,
      }),
    )
    expect(posthog.register).toHaveBeenCalledWith(venue)
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled()
  })

  it("adds the landing campaign to the super properties", async () => {
    const analytics = await loadClient(
      fakeWindow({ search: "?utm_source=instagram&ref=story&x=1" }),
    )
    analytics.initAnalytics(venue)
    expect(posthog.register).toHaveBeenCalledWith({
      ...venue,
      utm_source: "instagram",
      ref: "story",
    })
  })

  it("does nothing without a PostHog key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "")
    const analytics = await loadClient()
    analytics.initAnalytics(venue)
    analytics.track("list_view_opened", {})
    expect(posthog.init).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(analytics.isAnalyticsConfigured()).toBe(false)
  })
})

describe("consent", () => {
  it("sends nothing before consent, then replays the waiting events on grant", async () => {
    const win = fakeWindow()
    const analytics = await loadClient(win)
    analytics.initAnalytics(venue)
    analytics.track("experience_viewed", { webgl_supported: true })
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(analytics.getConsent()).toBeNull()

    analytics.setConsent(true)
    expect(win.localStorage.getItem("vyra-consent")).toBe("granted")
    expect(posthog.set_config).toHaveBeenCalledWith({ persistence: "localStorage+cookie" })
    expect(posthog.opt_in_capturing).toHaveBeenCalledOnce()
    expect(posthog.startSessionRecording).toHaveBeenCalledOnce()
    expect(posthog.capture).toHaveBeenCalledWith(
      "experience_viewed",
      { webgl_supported: true },
      { timestamp: expect.any(Date) },
    )

    analytics.track("table_view_from_seat", { table_id: "v1" })
    expect(posthog.capture).toHaveBeenLastCalledWith("table_view_from_seat", { table_id: "v1" })
  })

  it("drops waiting events and opts out on refusal", async () => {
    const win = fakeWindow()
    const analytics = await loadClient(win)
    analytics.initAnalytics(venue)
    analytics.track("experience_viewed", { webgl_supported: true })

    analytics.setConsent(false)
    analytics.track("list_view_opened", {})
    expect(win.localStorage.getItem("vyra-consent")).toBe("denied")
    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce()
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(posthog.startSessionRecording).not.toHaveBeenCalled()
  })

  it("captures right away when consent was given on a previous visit", async () => {
    const analytics = await loadClient(fakeWindow({ consent: "granted" }))
    analytics.track("intro_skipped", { at_ms: 1200 })
    analytics.initAnalytics(venue)
    expect(posthog.startSessionRecording).toHaveBeenCalledOnce()
    expect(posthog.capture).toHaveBeenCalledWith(
      "intro_skipped",
      { at_ms: 1200 },
      { timestamp: expect.any(Date) },
    )
    analytics.track("list_view_opened", {})
    expect(posthog.capture).toHaveBeenLastCalledWith("list_view_opened", {})
  })

  it("notifies subscribers of the choice", async () => {
    const analytics = await loadClient()
    const listener = vi.fn()
    const unsubscribe = analytics.subscribeConsent(listener)
    analytics.setConsent(false)
    expect(listener).toHaveBeenCalledOnce()
    expect(analytics.getConsent()).toBe("denied")
    unsubscribe()
    analytics.setConsent(true)
    expect(listener).toHaveBeenCalledOnce()
  })

  it("still works when storage is blocked", async () => {
    const analytics = await loadClient({
      location: { search: "" },
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError")
        },
        setItem: () => {
          throw new Error("SecurityError")
        },
      },
    })
    expect(analytics.getConsent()).toBeNull()
    analytics.setConsent(true)
    expect(analytics.getConsent()).toBe("granted")
  })
})

describe("getAttribution", () => {
  it("reads utm parameters and ref once, trimmed and capped", async () => {
    const win = fakeWindow({ search: `?utm_source=%20ig%20&utm_campaign=${"x".repeat(250)}&foo=1` })
    const analytics = await loadClient(win)
    const attribution = analytics.getAttribution()
    expect(attribution).toEqual({ utm_source: "ig", utm_campaign: "x".repeat(200) })

    win.location.search = "?utm_source=other"
    expect(analytics.getAttribution()).toEqual(attribution)
  })

  it("is undefined without campaign parameters", async () => {
    const analytics = await loadClient(fakeWindow({ search: "?foo=bar" }))
    expect(analytics.getAttribution()).toBeUndefined()
  })
})
