"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Check,
  Crown,
  Disc3,
  Gem,
  Leaf,
  Martini,
  Minus,
  Plus,
  Sofa,
  Sunrise,
  type LucideIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useId, type ComponentProps, type CSSProperties, type ReactNode } from "react"

import type { ZoneIcon } from "@/lib/schema"
import { cn } from "@/lib/utils"
import type { TableKind } from "@/lib/venue/layout"
import { STATUS, tierColor, tierDeep, withAlpha, type TableStatus } from "@/lib/venue/tiers"

/*
 * Night Glass primitives: pills and circles in liquid glass, one accent action, app-icon tiles,
 * and the few Apple controls the flow needs (segmented control, stepper, switch).
 */

export const SPRING = { type: "spring", stiffness: 420, damping: 36 } as const
export const SOFT_SPRING = { type: "spring", stiffness: 260, damping: 30 } as const

export const btn = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform,filter] duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/70 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        brand: "brand-pill hover:brightness-[1.06]",
        glass:
          "bg-fill text-label shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-white/[0.16]",
        plain: "text-label-2 hover:bg-fill-2 hover:text-label",
      },
      size: {
        sm: "h-8 px-3.5 text-footnote [&_svg]:size-3.5",
        md: "h-10 px-4 text-ui [&_svg]:size-4",
        lg: "h-12 px-6 text-callout [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
)

export function Btn({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof btn>) {
  return <button type="button" className={cn(btn({ variant, size }), className)} {...props} />
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "text-label-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-white/[0.1] px-1 font-sans text-[11px] leading-none font-medium shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)]",
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** Glass tooltip with an optional keyboard shortcut. */
export function Hint({
  label,
  keys,
  side = "top",
  children,
}: {
  label: string
  keys?: string[]
  side?: "top" | "bottom" | "left" | "right"
  children: React.ReactElement
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={10} className="z-[80]">
          <TooltipPrimitive.Popup className="glass text-footnote text-label flex items-center gap-2 rounded-full py-1.5 pr-2 pl-3 transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {label}
            {keys?.length ? (
              <span className="flex gap-0.5">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            ) : (
              <span className="w-0.5" />
            )}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/** Round liquid-glass button carrying one icon. */
export function RoundBtn({
  label,
  keys,
  side,
  active,
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  label: string
  keys?: string[]
  side?: "top" | "bottom" | "left" | "right"
  active?: boolean
  size?: "sm" | "md"
}) {
  return (
    <Hint label={label} keys={keys} side={side}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "glass glass-rim text-label focus-visible:ring-brand/70 relative grid shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-200 outline-none hover:bg-white/[0.12] focus-visible:ring-2 active:scale-95",
          size === "md" ? "size-10 [&_svg]:size-[18px]" : "size-8 [&_svg]:size-4",
          active && "bg-white/[0.16]",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Hint>
  )
}

/** Plain icon button for use inside a glass surface. */
export function IconBtn({
  label,
  keys,
  active,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { label: string; keys?: string[]; active?: boolean }) {
  return (
    <Hint label={label} keys={keys}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "text-label-2 hover:bg-fill hover:text-label focus-visible:ring-brand/70 grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-150 outline-none focus-visible:ring-2 [&_svg]:size-4",
          active && "bg-fill text-label",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Hint>
  )
}

/** Status glyphs: ring + dot (available), half disc (on request), slashed ring (sold). */
export function StatusIcon({ status, className }: { status: TableStatus; className?: string }) {
  const color = STATUS[status].color
  return (
    <svg
      viewBox="0 0 14 14"
      className={cn("size-3.5 shrink-0", className)}
      aria-hidden
      style={{ color }}
    >
      <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {status === "available" ? <circle cx="7" cy="7" r="2.4" fill="currentColor" /> : null}
      {status === "on_request" ? (
        <path d="M7 4.25a2.75 2.75 0 0 1 0 5.5Z" fill="currentColor" />
      ) : null}
      {status === "sold" ? (
        <path d="M4.6 9.4 9.4 4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
    </svg>
  )
}

export function TierDot({ tier, className }: { tier: TableKind; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{
        background: tierColor(tier),
        boxShadow: `0 0 10px ${withAlpha(tierColor(tier), 0x99 / 255)}`,
      }}
    />
  )
}

const GLYPHS: Record<ZoneIcon, LucideIcon> = {
  leaf: Leaf,
  martini: Martini,
  disc: Disc3,
  sunrise: Sunrise,
  sofa: Sofa,
  crown: Crown,
  gem: Gem,
}

export function ZoneGlyph({ icon, className }: { icon: ZoneIcon; className?: string }) {
  const Glyph = GLYPHS[icon]
  return <Glyph className={className} strokeWidth={1.75} aria-hidden />
}

/**
 * App-icon tile (macOS dock): squircle, tier gradient, glossy top light, white glyph.
 * `tone` "graphite" is for actions, "ink" for the club itself.
 */
export function Tile({
  tier,
  tone,
  className,
  style,
  children,
}: {
  tier?: TableKind
  tone?: "graphite" | "ink"
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const background = tier
    ? `radial-gradient(120% 90% at 30% 0%, ${tierColor(tier)} 0%, ${tierDeep(tier)} 78%)`
    : tone === "ink"
      ? "radial-gradient(120% 100% at 30% 0%, #2b2420 0%, #070507 72%)"
      : "radial-gradient(120% 100% at 30% 0%, #5a5662 0%, #222027 75%)"
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[23%] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_0_0_0.5px_rgb(255_255_255/0.18),0_6px_14px_-4px_rgb(0_0_0/0.6)] [&_svg]:size-[46%] [&_svg]:drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]",
        className,
      )}
      style={{ background, ...style }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.18] to-transparent"
      />
      {children}
    </span>
  )
}

export function ZoneTile({
  tier,
  icon,
  className,
}: {
  tier: TableKind
  icon: ZoneIcon
  className?: string
}) {
  return (
    <Tile tier={tier} className={className}>
      <ZoneGlyph icon={icon} />
    </Tile>
  )
}

/** Red counter badge, as on a dock icon. */
export function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        "num absolute -top-1 -right-1 z-10 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff453a] px-1 text-[11px] leading-none font-semibold text-white shadow-[0_2px_6px_rgb(0_0_0/0.45)]",
        className,
      )}
    >
      {count}
    </span>
  )
}

export function Eyebrow({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <p className={cn("eyebrow text-label-3", className)} style={style}>
      {children}
    </p>
  )
}

/** Apple segmented control with a sliding glass thumb. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T
  options: { value: T; label: string; short?: string }[]
  onChange: (value: T) => void
  label: string
  className?: string
  size?: "sm" | "md"
}) {
  const id = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex items-center rounded-full bg-black/25 p-[3px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]",
        size === "md" ? "h-9" : "h-8",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-brand/70 relative isolate h-full rounded-full px-3.5 font-medium whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2",
              size === "md" ? "text-footnote" : "text-caption",
              active ? "text-label" : "text-label-2 hover:text-label",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`thumb-${id}`}
                transition={SPRING}
                className="absolute inset-0 -z-10 rounded-full bg-white/[0.17] shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_3px_10px_rgb(0_0_0/0.35)]"
              />
            ) : null}
            {o.short ? (
              <>
                <span className="hidden sm:inline">{o.label}</span>
                <span className="sm:hidden">{o.short}</span>
              </>
            ) : (
              o.label
            )}
          </button>
        )
      })}
    </div>
  )
}

/** − value + */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  format = String,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  label: string
  format?: (value: number) => string
}) {
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)))
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-9 items-center rounded-full bg-black/25 p-[3px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]"
    >
      <button
        type="button"
        aria-label="Moins"
        disabled={value <= min}
        onClick={() => step(-1)}
        className="text-label grid size-[30px] place-items-center rounded-full bg-white/[0.12] transition-[background-color,opacity] hover:bg-white/[0.2] disabled:opacity-30 [&_svg]:size-3.5"
      >
        <Minus strokeWidth={2.25} />
      </button>
      <output aria-live="polite" className="num text-ui text-label w-12 text-center font-medium">
        {format(value)}
      </output>
      <button
        type="button"
        aria-label="Plus"
        disabled={value >= max}
        onClick={() => step(1)}
        className="text-label grid size-[30px] place-items-center rounded-full bg-white/[0.12] transition-[background-color,opacity] hover:bg-white/[0.2] disabled:opacity-30 [&_svg]:size-3.5"
      >
        <Plus strokeWidth={2.25} />
      </button>
    </div>
  )
}

/** Visual part of an iOS switch, driven by a sibling `peer` checkbox. */
export function SwitchTrack() {
  return (
    <span
      aria-hidden
      className="peer-focus-visible:ring-brand/70 relative h-[31px] w-[51px] shrink-0 rounded-full bg-white/[0.16] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] transition-colors duration-200 peer-checked:bg-[#30d158] peer-focus-visible:ring-2 peer-checked:[&>span]:translate-x-5"
    >
      <span className="absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.25),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-200 ease-[cubic-bezier(0.3,1.4,0.5,1)]" />
    </span>
  )
}

const STEPS = ["Table", "Coordonnées", "Envoi"] as const

/**
 * Where the buyer is in the request: choose a table, give contact details, send. Never mentions a
 * payment, which does not happen here. Phones keep only the current step's name.
 */
export function Steps({ current, className }: { current: 1 | 2 | 3; className?: string }) {
  return (
    <ol aria-label="Étapes de la demande" className={cn("flex items-center gap-2", className)}>
      {STEPS.map((label, index) => {
        const step = index + 1
        const state = step < current ? "done" : step === current ? "current" : "todo"
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span
              className={cn(
                "num grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-semibold [&_svg]:size-2.5",
                state === "todo" && "text-label-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]",
                state === "done" && "text-label bg-white/[0.14]",
              )}
              style={
                state === "current"
                  ? { background: "var(--brand)", color: "var(--brand-on)" }
                  : undefined
              }
            >
              {state === "done" ? <Check strokeWidth={3} aria-hidden /> : step}
            </span>
            <span
              className={cn(
                "text-caption truncate",
                state === "current" ? "text-label font-medium" : "text-label-3 max-sm:sr-only",
              )}
            >
              {label}
              {state === "done" ? <span className="sr-only"> (fait)</span> : null}
            </span>
            {step < STEPS.length ? (
              <span aria-hidden className="h-px w-3 shrink-0 bg-white/[0.16]" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Big number + caption, as in an Apple widget. */
export function Stat({
  value,
  label,
  accent,
}: {
  value: ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white/[0.045] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
      <p
        className={cn(
          "num text-[19px] leading-6 font-semibold tracking-[-0.01em]",
          accent ? "text-foil" : "text-label",
        )}
      >
        {value}
      </p>
      <p className="text-caption text-label-3 mt-0.5">{label}</p>
    </div>
  )
}
