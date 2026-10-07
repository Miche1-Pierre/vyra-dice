"use client"

import { ArrowLeft, Check, List, Mail, MessageCircle, RotateCcw, ScanEye } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import type { ZoneView } from "@/components/experience/view-model"
import { track } from "@/lib/analytics/client"
import { formatEuro } from "@/lib/format"
import type { VenueContent } from "@/lib/schema"
import { useExperience, type LevelFilter } from "@/lib/store"
import { cn } from "@/lib/utils"
import { STATUS, TIERS } from "@/lib/venue/tiers"

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex items-center gap-3 text-[11px] text-white/70", className)}>
      {Object.entries(STATUS).map(([key, s]) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

const LEVELS: { value: LevelFilter; label: string; short: string }[] = [
  { value: "all", label: "Tout le club", short: "Tout" },
  { value: 0, label: "Rez-de-chaussée", short: "RDC" },
  { value: 1, label: "Mezzanine", short: "Mezz." },
]

export function LevelToggle({ className }: { className?: string }) {
  const level = useExperience((s) => s.levelFilter)
  const setLevel = useExperience((s) => s.setLevelFilter)
  return (
    <div
      role="radiogroup"
      aria-label="Niveau affiché"
      className={cn(
        "flex rounded-full border border-white/10 bg-black/60 p-0.5 backdrop-blur-md",
        className,
      )}
    >
      {LEVELS.map((l) => (
        <button
          key={String(l.value)}
          type="button"
          role="radio"
          aria-checked={level === l.value}
          onClick={() => {
            setLevel(l.value)
            track("level_filter_changed", { level: String(l.value) as "all" | "0" | "1" })
          }}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            level === l.value ? "bg-white text-black" : "text-white/70 hover:text-white",
          )}
        >
          <span className="hidden sm:inline">{l.label}</span>
          <span className="sm:hidden">{l.short}</span>
        </button>
      ))}
    </div>
  )
}

export function FallbackContact({
  club,
  context,
  className,
}: {
  club: VenueContent["club"]
  context: string
  className?: string
}) {
  const ig = club.contact.instagram
  const email = club.contact.email
  if (!ig && !email) return null
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm", className)}>
      <p className="text-white/70">Un groupe, une question, un souci avec la page ?</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {ig ? (
          <a
            href={`https://ig.me/m/${ig}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("fallback_contact_clicked", { channel: "instagram", context })}
            className="inline-flex items-center gap-1.5 font-medium text-white hover:underline"
          >
            <MessageCircle className="size-4" /> Écrire au club (Instagram)
          </a>
        ) : null}
        {email ? (
          <a
            href={`mailto:${email}`}
            onClick={() => track("fallback_contact_clicked", { channel: "email", context })}
            className="inline-flex items-center gap-1.5 text-white/80 hover:underline"
          >
            <Mail className="size-4" /> {email}
          </a>
        ) : null}
      </div>
    </div>
  )
}

export function DemoNotice({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[11px] leading-snug text-amber-100/90",
        className,
      )}
    >
      {text}
    </p>
  )
}

const STEPS = ["Choisissez votre table", "Vos coordonnées", "Demande au club"]

function Steps() {
  const panel = useExperience((s) => s.panel)
  const current = panel === "ack" ? 3 : panel === "request" ? 1 : 0
  return (
    <ol className="space-y-2.5">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border text-[11px] font-semibold",
                done && "border-emerald-400 bg-emerald-400 text-black",
                active && "border-white bg-white text-black",
                !done && !active && "border-white/25 text-white/50",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "font-heading text-[13px] tracking-wide uppercase",
                active ? "text-white" : "text-white/45",
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function Sidebar({
  content,
  zones,
  eventLine,
  className,
}: {
  content: VenueContent
  zones: ZoneView[]
  eventLine: string
  className?: string
}) {
  const focusZone = useExperience((s) => s.focusZone)
  const focusedZoneId = useExperience((s) => s.focusedZoneId)
  return (
    <aside
      className={cn(
        "flex w-[340px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-white/[0.07] bg-[#0b0810] p-6",
        className,
      )}
    >
      <div>
        <p className="font-mono text-[11px] tracking-[0.25em] text-white/50 uppercase">
          {eventLine}
        </p>
        <h1 className="font-heading mt-2 text-3xl font-extrabold tracking-tight text-white">
          {content.club.name}
        </h1>
        <p className="mt-1 text-sm text-white/55">{content.club.address}</p>
      </div>
      <Steps />
      <div className="space-y-2">
        <p className="font-mono text-[11px] tracking-[0.2em] text-white/45 uppercase">Espaces</p>
        <ul className="space-y-1">
          {zones.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                onClick={() => focusZone(z.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  focusedZoneId === z.id
                    ? "border-white/30 bg-white/[0.07]"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: TIERS[z.tier].color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{z.name}</span>
                  <span className="block text-[11px] text-white/50">
                    {TIERS[z.tier].label} · {z.level === 0 ? "Rez-de-chaussée" : "Mezzanine"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-xs text-white">
                    {z.fromMinimum !== null ? `dès ${formatEuro(z.fromMinimum)}` : "Complet"}
                  </span>
                  <span className="flex items-center justify-end gap-1 text-[11px] text-white/50">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: STATUS[z.availability.tone].color }}
                    />
                    {z.availability.label}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto space-y-3">
        <TicketLink url={content.event.ticketUrl} />
        <FallbackContact club={content.club} context="sidebar" />
        {content.club.demo ? <DemoNotice text={content.club.disclaimer} /> : null}
      </div>
    </aside>
  )
}

/** Plain redirect to the existing ticketing (not an integration). */
export function TicketLink({ url, className }: { url?: string; className?: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("ticket_link_clicked", { url })}
      className={cn(
        "flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/80 transition hover:border-white/25 hover:text-white",
        className,
      )}
    >
      <span>Pas de table ? Billets d’entrée</span>
      <span aria-hidden>↗</span>
    </a>
  )
}

export function TopBar({
  title,
  subtitle,
  isDesktop,
}: {
  title: string
  subtitle: string
  isDesktop: boolean
}) {
  const view = useExperience((s) => s.view)
  const resetView = useExperience((s) => s.resetView)
  const openPanel = useExperience((s) => s.openPanel)
  const panel = useExperience((s) => s.panel)
  const showBack = view === "zone" || view === "table"
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 lg:px-6 lg:pt-5">
      <div className="pointer-events-auto flex min-w-0 items-center gap-2">
        {showBack ? (
          <button
            type="button"
            onClick={resetView}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
            aria-label="Retour à la vue d’ensemble"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="font-heading truncate text-base font-bold tracking-wide text-white uppercase lg:text-xl 2xl:text-2xl">
            {title}
          </p>
          <p className="truncate font-mono text-[10px] tracking-[0.2em] text-white/55 uppercase lg:hidden">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {isDesktop ? <StatusLegend className="mr-2 hidden 2xl:flex" /> : null}
        <LevelToggle />
        <button
          type="button"
          onClick={() => {
            openPanel(panel === "list" ? null : "list")
            if (panel !== "list") track("list_view_opened", {})
          }}
          className={cn(
            "grid size-9 place-items-center rounded-full border border-white/15 backdrop-blur-md",
            panel === "list" ? "bg-white text-black" : "bg-black/60 text-white hover:bg-black/80",
          )}
          aria-label="Liste des tables"
        >
          <List className="size-4" />
        </button>
        {isDesktop ? (
          <button
            type="button"
            onClick={resetView}
            className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 text-xs text-white backdrop-blur-md hover:bg-black/80"
          >
            <RotateCcw className="size-3.5" /> Vue d’ensemble
          </button>
        ) : null}
      </div>
    </header>
  )
}

/** Hint + exit button while looking around from a seat (and the request CTA on phones). */
export function SeatOverlay({
  tableLabel,
  canRequest,
}: {
  tableLabel: string | null
  canRequest: boolean
}) {
  const view = useExperience((s) => s.view)
  const leaveSeat = useExperience((s) => s.leaveSeat)
  const openPanel = useExperience((s) => s.openPanel)
  return (
    <AnimatePresence>
      {view === "seat" ? (
        <motion.div
          key="seat"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-30 flex justify-center px-4">
            <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/70 py-1.5 pr-1.5 pl-4 text-sm text-white backdrop-blur-md">
              <ScanEye className="size-4 shrink-0 text-white/70" />
              <span className="truncate">
                Vue depuis la table {tableLabel}{" "}
                <span className="text-white/50">· glissez pour regarder</span>
              </span>
              <button
                type="button"
                onClick={leaveSeat}
                className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black"
              >
                Quitter
              </button>
            </div>
          </div>
          {canRequest ? (
            <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  leaveSeat()
                  openPanel("request")
                }}
                className="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-semibold"
              >
                Demander la table {tableLabel}
              </button>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
