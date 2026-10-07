"use client"

import { useProgress } from "@react-three/drei"
import { AnimatePresence, motion } from "motion/react"

import { useExperience } from "@/lib/store"

export function LoadingScreen({ clubName, eventLine }: { clubName: string; eventLine: string }) {
  const { progress } = useProgress()
  const ready = useExperience((s) => s.sceneReady)
  const fallback = useExperience((s) => s.fallback2d)
  const visible = !ready && !fallback

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="loading"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.9, ease: "easeOut" } }}
          className="absolute inset-0 z-50 grid place-items-center bg-[radial-gradient(ellipse_at_center,#1d1226_0%,#0b0810_55%,#050407_100%)]"
        >
          <div className="flex w-[min(78vw,360px)] flex-col items-center gap-6 text-center">
            <p className="font-mono text-[11px] tracking-[0.3em] text-white/50 uppercase">
              {eventLine}
            </p>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              {clubName}
            </h1>
            <div className="h-px w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-fuchsia-500 via-violet-400 to-amber-300"
                animate={{ width: `${Math.max(6, progress)}%` }}
                transition={{ ease: "easeOut", duration: 0.4 }}
              />
            </div>
            <p className="text-sm text-white/60">Préparation de la visite 3D…</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** "Passer" button shown while the intro fly-through plays. */
export function IntroSkip() {
  const view = useExperience((s) => s.view)
  const ready = useExperience((s) => s.sceneReady)
  return (
    <AnimatePresence>
      {view === "intro" && ready ? (
        <motion.p
          key="skip"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 1.2 } }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] z-40 text-center font-mono text-[11px] tracking-[0.25em] text-white/60 uppercase"
        >
          Touchez l’écran pour passer
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}
