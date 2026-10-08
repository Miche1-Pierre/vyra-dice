"use client"

import { useFrame } from "@react-three/fiber"

/**
 * `?freeze=<seconds>` pins the scene clock: LED rain, light show, beams and halos stop at the
 * same instant on every load, so captures can be compared before and after a change.
 */
export function readFrozenTime(): number | null {
  if (typeof window === "undefined") return null
  const raw = new URLSearchParams(window.location.search).get("freeze")
  if (raw === null) return null
  const t = Number(raw)
  return Number.isFinite(t) && t >= 0 ? t : null
}

/** Runs before every other frame callback and overwrites the elapsed time they read. */
export function FrozenClock({ at }: { at: number }) {
  useFrame((state) => {
    state.clock.elapsedTime = at
  }, -1000)
  return null
}
