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

/** ≥ 1024 px: sidebar + floating panels; below: full-screen canvas + bottom sheets. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)", true)
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
