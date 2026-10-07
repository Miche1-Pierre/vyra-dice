"use client"

import { motion } from "motion/react"
import { useId } from "react"

import { cn } from "@/lib/utils"

/*
 * Club identity in the UI. Naho gets a drawn wordmark in the spirit of its sign (thin strokes,
 * an A without crossbar) and a rising-sun mark; other clubs fall back to spaced capitals.
 */

const GOLD_STOPS = [
  ["0%", "#f8e3b0"],
  ["55%", "#e2b868"],
  ["100%", "#b8893f"],
] as const

function GoldGradient({ id, vertical = true }: { id: string; vertical?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
      {GOLD_STOPS.map(([offset, color]) => (
        <stop key={offset} offset={offset} stopColor={color} />
      ))}
    </linearGradient>
  )
}

/** Rising sun: a solid half disc and seven rays. `draw` animates it in (loading screen). */
export function SunMark({ className, draw = false }: { className?: string; draw?: boolean }) {
  const id = useId()
  // rounded: server and browser trigonometry differ in the last digits (hydration mismatch)
  const r3 = (v: number) => Math.round(v * 1000) / 1000
  const rays = Array.from({ length: 7 }, (_, i) => {
    const a = Math.PI - ((i + 0.5) * Math.PI) / 7
    const long = i % 2 === 0
    const r0 = 7
    const r1 = long ? 11.4 : 9.8
    return {
      x1: r3(12 + Math.cos(a) * r0),
      y1: r3(13 - Math.sin(a) * r0),
      x2: r3(12 + Math.cos(a) * r1),
      y2: r3(13 - Math.sin(a) * r1),
    }
  })
  const fill = `url(#${id})`
  const reveal = (i: number) =>
    draw
      ? {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { delay: 0.35 + i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
        }
      : {}
  return (
    <svg viewBox="0 0 24 14.5" className={cn("h-4 w-auto", className)} aria-hidden fill="none">
      <defs>
        <GoldGradient id={id} />
      </defs>
      <motion.path
        d="M7 13a5 5 0 0 1 10 0Z"
        fill={fill}
        {...(draw
          ? {
              initial: { opacity: 0, y: 3 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
            }
          : {})}
      />
      {rays.map((r, i) => (
        <motion.line
          key={i}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke={fill}
          strokeWidth="1.35"
          strokeLinecap="round"
          {...reveal(i)}
        />
      ))}
      <motion.line
        x1="2.5"
        y1="13.4"
        x2="21.5"
        y2="13.4"
        stroke={fill}
        strokeWidth="1.1"
        strokeLinecap="round"
        {...reveal(7)}
      />
    </svg>
  )
}

/** N Λ H O, drawn with round-capped strokes (viewBox 70 × 20). */
const NAHO_STROKES = [
  "M1.5 18V2.4L13 17.6V2",
  "M18.5 18 25 2.2 31.5 18",
  "M36.5 2v16M48.5 2v16M36.5 10.1h12",
  "M61.2 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16",
]

export function Wordmark({
  club,
  className,
  draw = false,
  gold = false,
}: {
  club: { slug: string; name: string }
  className?: string
  draw?: boolean
  gold?: boolean
}) {
  const id = useId()
  if (club.slug !== "naho") {
    return (
      <span
        className={cn("text-[15px] leading-none font-light tracking-[0.3em] uppercase", className)}
      >
        {club.name.replace(/\s*club$/i, "")}
      </span>
    )
  }
  return (
    <svg
      viewBox="0 0 70 20"
      role="img"
      aria-label={club.name}
      className={cn("h-3.5 w-auto overflow-visible", className)}
      fill="none"
    >
      {gold ? (
        <defs>
          <GoldGradient id={id} />
        </defs>
      ) : null}
      {NAHO_STROKES.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke={gold ? `url(#${id})` : "currentColor"}
          strokeWidth="1.55"
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

/** « C L U B » line under the wordmark. */
export function ClubLine({ className }: { className?: string }) {
  return (
    <span
      className={cn("text-[8px] leading-none font-normal tracking-[0.62em] uppercase", className)}
    >
      Club
    </span>
  )
}
