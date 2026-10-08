import { AlertTriangle, Check, Circle, Loader2, Minus, RotateCcw, X } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { StepState } from "@studio/lib/state"

/* Studio primitives on top of the product's Night Glass tokens. */

export function Panel({
  className,
  children,
  as: As = "section",
}: {
  className?: string
  children: ReactNode
  as?: "section" | "div" | "aside"
}) {
  return <As className={cn("glass glass-rim relative rounded-[28px]", className)}>{children}</As>
}

export const STATE_STYLE: Record<StepState, { label: string; tone: string }> = {
  todo: { label: "À faire", tone: "text-label-3" },
  running: { label: "En cours", tone: "text-brand" },
  done: { label: "Fait", tone: "text-ok" },
  stale: { label: "À refaire", tone: "text-wait" },
  failed: { label: "Échec", tone: "text-[#ff6961]" },
  skipped: { label: "Sans objet", tone: "text-label-3" },
}

export function StateIcon({ state, className }: { state: StepState; className?: string }) {
  const base = cn("size-[18px] shrink-0", STATE_STYLE[state].tone, className)
  if (state === "running")
    return <Loader2 className={cn(base, "animate-spin")} aria-label="En cours" />
  if (state === "done") {
    return (
      <span
        className={cn(
          "bg-ok/15 grid size-[22px] shrink-0 place-items-center rounded-full",
          className,
        )}
      >
        <Check className="text-ok size-3.5" strokeWidth={2.5} aria-label="Fait" />
      </span>
    )
  }
  if (state === "stale") return <RotateCcw className={base} aria-label="À refaire" />
  if (state === "failed") return <AlertTriangle className={base} aria-label="Échec" />
  if (state === "skipped") return <Minus className={base} aria-label="Sans objet" />
  return <Circle className={base} strokeWidth={1.6} aria-label="À faire" />
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode
  tone?: "neutral" | "ok" | "warn" | "bad" | "brand"
  className?: string
}) {
  const tones = {
    neutral: "bg-white/[0.07] text-label-2",
    ok: "bg-ok/15 text-ok",
    warn: "bg-wait/15 text-wait",
    bad: "bg-[#ff453a]/15 text-[#ff6961]",
    brand: "bg-brand/15 text-brand",
  }
  return (
    <span
      className={cn(
        "text-caption inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-footnote text-label-3 py-10 text-center">{children}</p>
}

export function CloseButton({
  onClick,
  label = "Fermer",
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-label-2 hover:bg-fill hover:text-label grid size-9 place-items-center rounded-full transition-colors"
    >
      <X className="size-4" />
    </button>
  )
}

export function duration(from?: string, to?: string): string {
  if (!from) return ""
  const ms = (to ? Date.parse(to) : Date.now()) - Date.parse(from)
  if (ms < 1000) return "< 1 s"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return m < 60
    ? `${m} min ${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`
}

export function ago(iso?: string): string {
  if (!iso) return ""
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export const fileUrl = (slug: string, rel: string) =>
  `/api/clubs/${slug}/file?path=${encodeURIComponent(rel)}`
