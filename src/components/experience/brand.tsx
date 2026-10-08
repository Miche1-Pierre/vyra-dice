"use client"

import { motion } from "motion/react"
import { useId } from "react"

import type { ClubBrand } from "@/lib/clubs/brand"
import { cn } from "@/lib/utils"

/*
 * Club identity in the UI, drawn from its brand.json: the emblem, the wordmark (thin
 * round-capped strokes) and the tagline under it. Clubs without a drawn wordmark get their name
 * in spaced capitals. Marks are filled with the club's foil (`--foil-*`).
 */

const EASE_OUT = [0.16, 1, 0.3, 1] as const

function FoilGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style={{ stopColor: "var(--foil-hi)" }} />
      <stop offset="55%" style={{ stopColor: "var(--foil)" }} />
      <stop offset="100%" style={{ stopColor: "var(--foil-lo)" }} />
    </linearGradient>
  )
}

/** The club's emblem. `draw` animates it in (loading screen): shapes rise, strokes draw. */
export function Emblem({
  emblem,
  className,
  draw = false,
}: {
  emblem: ClubBrand["emblem"]
  className?: string
  draw?: boolean
}) {
  const id = useId()
  if (!emblem) return null
  const fill = `url(#${id})`
  let strokes = 0
  return (
    <svg
      viewBox={`0 0 ${emblem.viewBox[0]} ${emblem.viewBox[1]}`}
      className={cn("h-4 w-auto", className)}
      aria-hidden
      fill="none"
    >
      <defs>
        <FoilGradient id={id} />
      </defs>
      {emblem.shapes.map(({ d, stroke }) => {
        if (stroke === undefined) {
          return (
            <motion.path
              key={d}
              d={d}
              fill={fill}
              {...(draw
                ? {
                    initial: { opacity: 0, y: 3 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.9, ease: EASE_OUT },
                  }
                : {})}
            />
          )
        }
        const order = strokes++
        return (
          <motion.path
            key={d}
            d={d}
            stroke={fill}
            strokeWidth={stroke}
            strokeLinecap="round"
            {...(draw
              ? {
                  initial: { pathLength: 0, opacity: 0 },
                  animate: { pathLength: 1, opacity: 1 },
                  transition: { delay: 0.35 + order * 0.07, duration: 0.6, ease: EASE_OUT },
                }
              : {})}
          />
        )
      })}
    </svg>
  )
}

export function Wordmark({
  name,
  wordmark,
  className,
  draw = false,
  foil = false,
}: {
  name: string
  wordmark: ClubBrand["wordmark"]
  className?: string
  draw?: boolean
  foil?: boolean
}) {
  const id = useId()
  if (!wordmark) {
    return (
      <span
        className={cn("text-[15px] leading-none font-light tracking-[0.3em] uppercase", className)}
      >
        {name.replace(/\s*club$/i, "")}
      </span>
    )
  }
  return (
    <svg
      viewBox={`0 0 ${wordmark.viewBox[0]} ${wordmark.viewBox[1]}`}
      role="img"
      aria-label={name}
      className={cn("h-3.5 w-auto overflow-visible", className)}
      fill="none"
    >
      {foil ? (
        <defs>
          <FoilGradient id={id} />
        </defs>
      ) : null}
      {wordmark.strokes.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke={foil ? `url(#${id})` : "currentColor"}
          strokeWidth={wordmark.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(draw
            ? {
                initial: { pathLength: 0, opacity: 0 },
                animate: { pathLength: 1, opacity: 1 },
                transition: {
                  delay: 0.5 + i * 0.16,
                  duration: 0.9,
                  ease: [0.65, 0, 0.35, 1] as const,
                },
              }
            : {})}
        />
      ))}
    </svg>
  )
}

/** Spaced small capitals under the wordmark (« C L U B »). */
export function Tagline({ text, className }: { text?: string; className?: string }) {
  if (!text) return null
  return (
    <span
      className={cn("text-[8px] leading-none font-normal tracking-[0.62em] uppercase", className)}
    >
      {text}
    </span>
  )
}

/** The emblem, or the club's initial when its brand has none (dock tile, search). */
export function ClubMark({
  brand,
  name,
  className,
}: {
  brand: ClubBrand
  name: string
  className?: string
}) {
  if (brand.emblem) return <Emblem emblem={brand.emblem} className={className} />
  return (
    <span aria-hidden className="text-foil text-[18px] leading-none font-light">
      {name.charAt(0)}
    </span>
  )
}
