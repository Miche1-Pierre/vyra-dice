"use client"

import { useProgress } from "@react-three/drei"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef } from "react"

import { Emblem, Tagline, Wordmark } from "@/components/experience/brand"
import type { ClubBrand } from "@/lib/clubs/brand"
import { useExperience } from "@/lib/store"
import { cn } from "@/lib/utils"

/** The night's loop for the loading screen (`event.loader`), as URLs. */
export interface LoaderLoop {
  video: string
  poster: string
}

/**
 * The night's loop on the loading screen: a video, decoded and drawn off the main thread, so it
 * keeps its pace while the club is being built (a drawn logo stutters then). It comes in with a
 * flash and its edges melt into the screen; its still stands in before its first frame. Less
 * motion is honoured from the first paint, before any script runs: the still, no flash.
 */
function NightLoop({ loop, still }: { loop: LoaderLoop; still: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  // once the preference is known here too, the hidden video stops decoding
  useEffect(() => {
    if (still) video.current?.pause()
  }, [still])
  const melt = "[mask-image:radial-gradient(closest-side,#000_68%,transparent)]"
  return (
    <div className="relative size-[min(78vw,46vh,420px)]">
      <video
        ref={video}
        src={loop.video}
        poster={loop.poster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden
        className={cn("size-full object-cover motion-reduce:hidden", melt)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- the loop's own still, same size */}
      <img
        src={loop.poster}
        alt=""
        aria-hidden
        className={cn("hidden size-full object-cover motion-reduce:block", melt)}
      />
      {still ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgb(255_244_238/0.9),transparent_72%)] motion-reduce:hidden"
          style={{ animation: "vyra-flash 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both" }}
        />
      )}
    </div>
  )
}

/**
 * Signature reveal while the venue streams in: the emblem rises, the name draws itself; or the
 * night's loop, when it has one, which then hands over to the club with a flash.
 */
export function LoadingScreen({
  name,
  brand,
  eventLine,
  headliner,
  loop,
  still = false,
}: {
  name: string
  brand: ClubBrand
  eventLine: string
  /** A billed night (`event.subtitle`): its name in large capitals, like its poster. */
  headliner?: { name: string; subtitle: string; when: string }
  /** The night's loop (motion design), in place of the drawn logo. */
  loop?: LoaderLoop
  /** Less motion: the loop's still, without flashes. */
  still?: boolean
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
          {loop && !still ? (
            // the hand-over to the club: a white flash as the screen lifts (opacity only)
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              exit={{ opacity: [0, 0.85, 0], transition: { duration: 0.6, times: [0, 0.15, 1] } }}
              className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(70%_60%_at_50%_45%,rgb(255_244_238),rgb(255_244_238/0.35)_70%)] motion-reduce:hidden"
            />
          ) : null}
          <div
            className="relative flex flex-col items-center"
            role="status"
            aria-label={`Chargement de la visite 3D, ${Math.round(progress)} %`}
          >
            {loop ? (
              <>
                <NightLoop loop={loop} still={still} />
                <p className="sr-only">
                  {headliner ? `${name}, ${headliner.subtitle} : ${headliner.name}` : name}
                </p>
                <p className="text-footnote text-label-3 -mt-2">{headliner?.when ?? eventLine}</p>
              </>
            ) : (
              <>
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
              </>
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
