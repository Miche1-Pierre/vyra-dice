"use client"

import { useSyncExternalStore } from "react"

import type { Quality } from "@/components/scene/effects"

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener("change", cb)
    return () => mql.removeEventListener("change", cb)
  }
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}

/** ≥ 1024 px: dock with magnification + floating card; below: shelf + bottom sheets. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)", true)
}

/**
 * Layout breakpoints beyond desktop / phone: `roomy` desktops (≥ 1280 px) keep every control
 * next to an open card, `wide` screens (≥ 640 px, tablets) get centred sheets and dialogs, and
 * `shortLandscape` phones get a side card instead of a bottom sheet.
 */
export function useViewport() {
  const isDesktop = useIsDesktop()
  const roomy = useMediaQuery("(min-width: 1280px)", true)
  const wide = useMediaQuery("(min-width: 640px)", true)
  const shortLandscape = useMediaQuery(
    "(max-height: 499px) and (orientation: landscape) and (max-width: 1023px)",
    false,
  )
  return { isDesktop, roomy, wide, shortLandscape }
}

const noSubscription = () => () => {}

function detectQuality(): Quality {
  const coarse = window.matchMedia("(pointer: coarse)").matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  return coarse || small ? "low" : "high"
}

/** Rendering budget: phones and coarse pointers get the light post-processing chain. */
export function useQuality(): Quality | null {
  return useSyncExternalStore(noSubscription, detectQuality, () => null)
}

let webgl2: boolean | undefined
function detectWebGL(): boolean {
  if (webgl2 === undefined) {
    try {
      webgl2 = Boolean(document.createElement("canvas").getContext("webgl2"))
    } catch {
      webgl2 = false
    }
  }
  return webgl2
}

/** null during SSR, then whether WebGL2 is usable (probed once). */
export function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(noSubscription, detectWebGL, () => null)
}
