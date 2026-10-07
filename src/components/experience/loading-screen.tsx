"use client"

import { useProgress } from "@react-three/drei"
import { AnimatePresence, motion } from "motion/react"

import { ClubLine, SunMark, Wordmark } from "@/components/experience/brand"
import { useExperience } from "@/lib/store"

/** Signature reveal while the venue streams in: the sun rises, the name draws itself. */
export function LoadingScreen({
  club,
  eventLine,
}: {
  club: { slug: string; name: string }
  eventLine: string
}) {
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
          exit={{
            opacity: 0,
            scale: 1.04,
            filter: "blur(8px)",
            transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
          }}
          className="bg-ink absolute inset-0 z-50 grid place-items-center"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_42%,rgb(232_194_122/0.09),transparent_70%)]"
          />
          <div
            className="relative flex flex-col items-center"
            role="status"
            aria-label={`Chargement de la visite 3D, ${Math.round(progress)} %`}
          >
            <SunMark draw className="h-9" />
            <Wordmark club={club} draw gold className="text-label mt-5 h-9" />
            <ClubLine className="text-gold/80 mt-3 pl-[0.62em]" />
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="text-footnote text-label-3 mt-9"
            >
              {eventLine}
            </motion.p>
            <div className="mt-6 h-[2px] w-40 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className="from-gold-deep via-gold h-full rounded-full bg-gradient-to-r to-[#f8e3b0] shadow-[0_0_12px_rgb(232_194_122/0.7)]"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.max(3, progress)}%` }}
                transition={{ ease: "easeOut", duration: 0.4 }}
              />
            </div>
            <p className="num text-caption text-label-3 mt-3">{Math.round(progress)} %</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Shown while the intro fly-through plays. */
export function IntroSkip({ isDesktop }: { isDesktop: boolean }) {
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
          className="glass text-footnote text-label-2 pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 whitespace-nowrap"
        >
          {isDesktop
            ? "Cliquez ou appuyez sur une touche pour passer l’intro"
            : "Touchez l’écran pour passer l’intro"}
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}
