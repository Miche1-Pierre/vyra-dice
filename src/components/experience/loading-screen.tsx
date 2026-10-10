"use client"

import { useProgress } from "@react-three/drei"
import { AnimatePresence, motion } from "motion/react"

import { Emblem, Tagline, Wordmark } from "@/components/experience/brand"
import type { ClubBrand } from "@/lib/clubs/brand"
import { useExperience } from "@/lib/store"

/** Signature reveal while the venue streams in: the emblem rises, the name draws itself. */
export function LoadingScreen({
  name,
  brand,
  eventLine,
  headliner,
}: {
  name: string
  brand: ClubBrand
  eventLine: string
  /** A billed night (`event.subtitle`): its name in large capitals, like its poster. */
  headliner?: { name: string; subtitle: string; when: string }
}) {
  const { progress } = useProgress()
  const ready = useExperience((s) => s.sceneReady)
  const textOnly = useExperience((s) => s.fallback2d || s.listMode)
  const visible = !ready && !textOnly

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="loading"
          initial={{ opacity: 1 }}
          // opacity and scale only: the compositor runs it, the first frames of the club stay smooth
          exit={{
            opacity: 0,
            scale: 1.04,
            transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
          }}
          className="bg-ink absolute inset-0 z-50 grid place-items-center"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_42%,color-mix(in_srgb,var(--brand)_9%,transparent),transparent_70%)]"
          />
          <div
            className="relative flex flex-col items-center"
            role="status"
            aria-label={`Chargement de la visite 3D, ${Math.round(progress)} %`}
          >
            <Emblem emblem={brand.emblem} draw className="h-9" />
            <Wordmark
              name={name}
              wordmark={brand.wordmark}
              draw
              foil
              className="text-label mt-5 h-9"
            />
            <Tagline text={brand.tagline} className="text-brand/80 mt-3 pl-[0.62em]" />
            {headliner ? (
              <div
                className="mt-10 flex flex-col items-center text-center"
                style={{ animation: "vyra-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both" }}
              >
                <p className="text-label text-[52px] leading-none font-semibold tracking-[0.06em] uppercase sm:text-[72px]">
                  {headliner.name}
                </p>
                <p className="eyebrow text-brand mt-3">{headliner.subtitle}</p>
                <p className="text-footnote text-label-3 mt-4">{headliner.when}</p>
              </div>
            ) : (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.6 }}
                className="text-footnote text-label-3 mt-9"
              >
                {eventLine}
              </motion.p>
            )}
            <div className="mt-6 h-[2px] w-40 overflow-hidden rounded-full bg-white/[0.08]">
              {/* a transform transition: the compositor slides it even while the venue is parsed */}
              <div
                className="from-brand-deep via-brand h-full w-full rounded-full bg-gradient-to-r to-(--foil-hi) shadow-[0_0_12px_color-mix(in_srgb,var(--brand)_70%,transparent)] transition-transform duration-700 ease-out will-change-transform"
                style={{ transform: `translateX(${Math.max(3, progress) - 100}%)` }}
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
