import posthog from "posthog-js"

import type { AnalyticsEventName, AnalyticsEvents } from "@/lib/analytics/events"
import type { Attribution } from "@/lib/schema"

/** localStorage key holding the visitor's analytics choice. */
export const CONSENT_STORAGE_KEY = "vyra-consent"
export type ConsentChoice = "granted" | "denied"

const DEFAULT_API_HOST = "https://eu.i.posthog.com"
const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"] as const
const MAX_ATTRIBUTION_LENGTH = 200
/** Events kept in memory while the visitor has not answered the consent banner. */
const MAX_PENDING_EVENTS = 100

type PendingEvent = {
  name: AnalyticsEventName
  props: AnalyticsEvents[AnalyticsEventName]
  at: Date
}

let initialized = false
/** `undefined` until read from storage. */
let consent: ConsentChoice | null | undefined
let attribution: Attribution | undefined
let attributionRead = false
let pending: PendingEvent[] = []
const consentListeners = new Set<() => void>()

/** Whether this build has a PostHog project key. */
export function isAnalyticsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
}

/** The visitor's choice, or `null` while they have not answered (always `null` on the server). */
export function getConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null
  if (consent === undefined) {
    try {
      const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY)
      consent = stored === "granted" || stored === "denied" ? stored : null
    } catch {
      consent = null // storage blocked: ask again
    }
  }
  return consent
}

/** Calls `listener` whenever the choice changes (shaped for `useSyncExternalStore`). */
export function subscribeConsent(listener: () => void): () => void {
  consentListeners.add(listener)
  return () => {
    consentListeners.delete(listener)
  }
}

/**
 * Starts PostHog for a venue page: in-memory persistence, no autocapture, no page views and no
 * session replay until the visitor consents. Does nothing without `NEXT_PUBLIC_POSTHOG_KEY`.
 */
export function initAnalytics({
  club,
  event,
  demo,
}: {
  club: string
  event: string
  demo: boolean
}): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || typeof window === "undefined") return
  if (!initialized) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_API_HOST,
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      // Replays never contain what buyers type (name, phone, e-mail, message).
      session_recording: { maskAllInputs: true, maskTextSelector: "[data-ph-mask]" },
      // Nothing is captured before an explicit opt-in, including captures enabled remotely.
      opt_out_capturing_by_default: true,
    })
    initialized = true
  }
  posthog.register({ club, event, demo, ...getAttribution() })
  if (getConsent() === "granted") enableCapture()
}

/** Stores the visitor's choice. Granting enables cookies, capture and session replay. */
export function setConsent(granted: boolean): void {
  consent = granted ? "granted" : "denied"
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent)
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  if (granted) {
    if (initialized) enableCapture()
  } else {
    pending = []
    if (initialized) {
      posthog.stopSessionRecording()
      posthog.opt_out_capturing()
    }
  }
  for (const listener of consentListeners) listener()
}

function enableCapture(): void {
  posthog.set_config({ persistence: "localStorage+cookie" })
  if (!posthog.has_opted_in_capturing()) posthog.opt_in_capturing({ captureEventName: false })
  posthog.startSessionRecording()
  const queued = pending
  pending = []
  for (const { name, props, at } of queued) posthog.capture(name, props, { timestamp: at })
}

/**
 * Captures a taxonomy event once the visitor has consented. Nothing is sent before that: while
 * the banner is unanswered, events wait in memory, sent with their original time if the visitor
 * accepts and dropped if they refuse. Without a PostHog key, logs to the console in development.
 */
export function track<K extends AnalyticsEventName>(name: K, props: AnalyticsEvents[K]): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    if (process.env.NODE_ENV === "development") console.debug("[analytics]", name, props)
    return
  }
  const choice = getConsent()
  if (typeof window === "undefined" || choice === "denied") return
  if (initialized && choice === "granted") {
    posthog.capture(name, props)
    return
  }
  pending.push({ name, props, at: new Date() })
  if (pending.length > MAX_PENDING_EVENTS) pending.shift()
}

/**
 * Campaign parameters of the landing URL (`utm_*`, `ref`), read once per page load so they
 * survive client-side navigation. `undefined` when there are none.
 */
export function getAttribution(): Attribution | undefined {
  if (typeof window === "undefined") return undefined
  if (!attributionRead) {
    attributionRead = true
    const params = new URLSearchParams(window.location.search)
    const found: Attribution = {}
    for (const key of ATTRIBUTION_KEYS) {
      const value = params.get(key)?.trim()
      if (value) found[key] = value.slice(0, MAX_ATTRIBUTION_LENGTH)
    }
    attribution = Object.keys(found).length > 0 ? found : undefined
  }
  return attribution && { ...attribution }
}
