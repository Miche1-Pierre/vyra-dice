"use client"

import { useEffect, useSyncExternalStore } from "react"

import { ConsentBanner } from "@/components/analytics/consent-banner"
import {
  getConsent,
  initAnalytics,
  isAnalyticsConfigured,
  subscribeConsent,
  type ConsentChoice,
} from "@/lib/analytics/client"

/** Unknown on the server, so the banner only appears once the stored choice can be read. */
const getServerConsent = () => undefined

/** Starts analytics for a venue page and asks for consent when no choice is stored yet. */
export function AnalyticsProvider({
  club,
  event,
  demo,
}: {
  club: string
  event: string
  demo: boolean
}) {
  useEffect(() => {
    initAnalytics({ club, event, demo })
  }, [club, event, demo])

  const consent = useSyncExternalStore<ConsentChoice | null | undefined>(
    subscribeConsent,
    getConsent,
    getServerConsent,
  )

  if (!isAnalyticsConfigured() || consent !== null) return null
  return <ConsentBanner />
}
