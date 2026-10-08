"use client"

import {
  AnimatePresence,
  motion,
  useAnimate,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
import { useRef, useState, type ReactNode } from "react"

import { Badge, Kbd, SOFT_SPRING } from "@/components/experience/ui"
import { cn } from "@/lib/utils"

export type DockEntry =
  | {
      kind: "item"
      id: string
      /** Name shown above the icon (desktop) or under it (phones). */
      label: string
      /** Second line of the desktop label, e.g. a price. */
      detail?: string
      /** Short name under the icon on phones. */
      short?: string
      keys?: string[]
      tile: ReactNode
      active?: boolean
      badge?: number
      disabled?: boolean
      href?: string
      onSelect?: () => void
    }
  | { kind: "separator"; id: string }

const BASE = 50
const PEAK = 76
const REACH = 190

/**
 * macOS-style dock: glass shelf, icons that swell under the pointer, a bounce when launched,
 * a dot under what is open. Phones get a scrollable shelf with labels instead.
 */
export function Dock({
  entries,
  hidden,
  isDesktop,
  dense = false,
}: {
  entries: DockEntry[]
  hidden?: boolean
  isDesktop: boolean
  /** Phones held sideways: icons only, to keep the club visible. */
  dense?: boolean
}) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)
  return (
    <AnimatePresence>
      {!hidden ? (
        isDesktop ? (
          <motion.nav
            key="dock"
            aria-label="Dock"
            initial={{ y: 110, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 110, opacity: 0 }}
            transition={SOFT_SPRING}
            onMouseMove={(e) => mouseX.set(e.clientX)}
            onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
            className="glass glass-rim absolute bottom-3.5 left-1/2 z-40 flex h-[68px] -translate-x-1/2 items-end gap-2 rounded-[26px] px-2.5 pb-[9px]"
          >
            <AnimatePresence initial={false}>
              {entries.map((e) =>
                e.kind === "separator" ? (
                  <span
                    key={e.id}
                    aria-hidden
                    className="mx-0.5 mb-[3px] h-11 w-px self-end bg-white/[0.14]"
                  />
                ) : (
                  <DockIcon key={e.id} entry={e} mouseX={mouseX} />
                ),
              )}
            </AnimatePresence>
          </motion.nav>
        ) : (
          <motion.nav
            key="dock-mobile"
            aria-label="Dock"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={SOFT_SPRING}
            className={cn(
              "glass glass-rim absolute inset-x-2.5 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-40 flex items-start rounded-[28px] px-1.5 sm:inset-x-0 sm:mx-auto sm:w-fit sm:max-w-[calc(100%-1.25rem)]",
              dense ? "py-1.5" : "pt-2 pb-1.5",
            )}
          >
            <MobileShelf entries={entries} dense={dense} />
          </motion.nav>
        )
      ) : null}
    </AnimatePresence>
  )
}

function DockIcon({
  entry,
  mouseX,
}: {
  entry: Extract<DockEntry, { kind: "item" }>
  mouseX: MotionValue<number>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scope, animate] = useAnimate()
  const [hover, setHover] = useState(false)
  const distance = useTransform(mouseX, (x) => {
    const b = ref.current?.getBoundingClientRect()
    return b ? x - (b.left + b.width / 2) : Number.POSITIVE_INFINITY
  })
  const target = useTransform(distance, [-REACH, 0, REACH], [BASE, PEAK, BASE], { clamp: true })
  const size = useSpring(target, { mass: 0.1, stiffness: 190, damping: 14 })

  const launch = () => {
    if (entry.disabled) return
    void animate(scope.current, { y: [0, -18, 0, -6, 0] }, { duration: 0.62, ease: "easeOut" })
    entry.onSelect?.()
  }

  const common = {
    "aria-label": entry.detail ? `${entry.label}, ${entry.detail}` : entry.label,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
    className: cn(
      "relative block size-full rounded-[23%] outline-none focus-visible:ring-2 focus-visible:ring-brand/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
      entry.disabled && "pointer-events-none opacity-40",
    ),
  }

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      className="relative flex shrink-0 flex-col items-center"
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.3, opacity: 0 }}
    >
      <AnimatePresence>
        {hover ? (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="glass text-footnote text-label pointer-events-none absolute bottom-[calc(100%+14px)] flex items-center gap-2 rounded-full py-1.5 pr-2.5 pl-3.5 whitespace-nowrap"
          >
            <span className="font-medium">{entry.label}</span>
            {entry.detail ? <span className="num text-label-2">{entry.detail}</span> : null}
            {entry.keys?.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <motion.div ref={scope} className="size-full">
        {entry.href ? (
          <a href={entry.href} target="_blank" rel="noreferrer" onClick={launch} {...common}>
            <span className="block size-full [&>*]:size-full">{entry.tile}</span>
          </a>
        ) : (
          <button type="button" onClick={launch} disabled={entry.disabled} {...common}>
            <span className="block size-full [&>*]:size-full">{entry.tile}</span>
          </button>
        )}
        {entry.badge ? <Badge count={entry.badge} /> : null}
      </motion.div>
      <span
        aria-hidden
        className={cn(
          "bg-label/85 absolute -bottom-[7px] size-[4px] rounded-full shadow-[0_0_6px_rgb(255_255_255/0.6)] transition-opacity duration-200",
          entry.active ? "opacity-100" : "opacity-0",
        )}
      />
    </motion.div>
  )
}

function MobileShelf({ entries, dense }: { entries: DockEntry[]; dense: boolean }) {
  // the club icon stays pinned left, actions pinned right, spaces scroll in between
  const firstSep = entries.findIndex((e) => e.kind === "separator")
  const lastSep = entries.findLastIndex((e) => e.kind === "separator")
  const head = entries.slice(0, firstSep)
  const middle = entries.slice(firstSep + 1, lastSep)
  const tail = entries.slice(lastSep + 1)
  const renderMobile = (entry: DockEntry) =>
    entry.kind === "separator" ? null : <MobileIcon key={entry.id} entry={entry} dense={dense} />
  return (
    <>
      <div className="flex shrink-0">{head.map(renderMobile)}</div>
      <span aria-hidden className="mt-2 h-9 w-px shrink-0 bg-white/[0.14]" />
      <div className="flex min-w-0 flex-1 snap-x [scrollbar-width:none] overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(90deg,transparent,#000_10px,#000_calc(100%-14px),transparent)]">
        {middle.map(renderMobile)}
      </div>
      <span aria-hidden className="mt-2 h-9 w-px shrink-0 bg-white/[0.14]" />
      <div className="flex shrink-0">{tail.map(renderMobile)}</div>
    </>
  )
}

function MobileIcon({
  entry,
  dense,
}: {
  entry: Extract<DockEntry, { kind: "item" }>
  dense: boolean
}) {
  const [scope, animate] = useAnimate()
  const body = (
    <>
      <span ref={scope} className="relative block size-11">
        <span className="block size-full [&>*]:size-full">{entry.tile}</span>
        {entry.badge ? <Badge count={entry.badge} /> : null}
      </span>
      {!dense ? (
        <span
          className={cn(
            "mt-1 max-w-[56px] truncate text-[10px] leading-3 font-medium",
            entry.active ? "text-label" : "text-label-2",
          )}
        >
          {entry.short ?? entry.label}
        </span>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "bg-label mt-0.5 size-[3px] rounded-full transition-opacity",
          entry.active ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  )
  const className = cn(
    "flex w-[58px] shrink-0 snap-start flex-col items-center outline-none active:scale-95 transition-transform",
    entry.disabled && "pointer-events-none opacity-40",
  )
  const press = () => {
    void animate(scope.current, { y: [0, -8, 0] }, { duration: 0.4, ease: "easeOut" })
    entry.onSelect?.()
  }
  return entry.href ? (
    <a
      href={entry.href}
      target="_blank"
      rel="noreferrer"
      aria-label={entry.label}
      onClick={press}
      className={className}
    >
      {body}
    </a>
  ) : (
    <button
      type="button"
      aria-label={entry.detail ? `${entry.label}, ${entry.detail}` : entry.label}
      onClick={press}
      className={className}
    >
      {body}
    </button>
  )
}
