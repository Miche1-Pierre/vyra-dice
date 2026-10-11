"use client"

import {
  AudioLines,
  ChevronLeft,
  Mail,
  MessageCircle,
  Phone,
  ScanEye,
  Search,
  Ticket,
  Volume2,
  VolumeX,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { Emblem, Wordmark } from "@/components/experience/brand"
import {
  Btn,
  Hint,
  Kbd,
  RoundBtn,
  SOFT_SPRING,
  Segmented,
  StatusIcon,
  TierDot,
} from "@/components/experience/ui"
import type { TableView, TicketView, ZoneView } from "@/components/experience/view-model"
import { track } from "@/lib/analytics/client"
import { contactMessage, instagramUrl, phoneUrl, whatsappUrl } from "@/lib/contact"
import { musicKey, pauseMusic, playMusic, prepareShow, pulse, show, unsealMusic } from "@/lib/music"
import type { ClubBrand } from "@/lib/clubs/brand"
import type { VenueContent } from "@/lib/schema"
import { useExperience, type LevelFilter } from "@/lib/store"
import { cn } from "@/lib/utils"
import { STATUS } from "@/lib/venue/tiers"

const LEVELS: { value: LevelFilter; label: string; short: string }[] = [
  { value: "all", label: "Tout le club", short: "Tout" },
  { value: 0, label: "Rez-de-chaussée", short: "RDC" },
  { value: 1, label: "Mezzanine", short: "Mezz." },
]

export function LevelSwitch({ className, size }: { className?: string; size?: "sm" | "md" }) {
  const level = useExperience((s) => s.levelFilter)
  const setLevel = useExperience((s) => s.setLevelFilter)
  return (
    <div
      className={cn("glass glass-rim sober:rounded-[11px] relative rounded-full p-1", className)}
    >
      <Segmented
        label="Niveau affiché"
        value={level}
        options={LEVELS}
        size={size}
        onChange={(v) => {
          setLevel(v)
          track("level_filter_changed", { level: String(v) as "all" | "0" | "1" })
        }}
      />
    </div>
  )
}

function shortDate(dateLabel: string) {
  // "samedi 10 octobre" -> "10 octobre"
  return dateLabel.replace(/^\S+\s/, "")
}

/** Club identity + where you are: event on the overview, then the space, then the table. */
function Context({
  content,
  zone,
  table,
  ticket,
  dateLabel,
  compact,
}: {
  content: VenueContent
  zone: ZoneView | null
  table: TableView | null
  ticket: TicketView | null
  dateLabel: string
  compact: boolean
}) {
  const key = ticket ? `b:${ticket.id}` : table ? `t:${table.id}` : zone ? `z:${zone.id}` : "club"
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={key}
        initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="text-footnote flex min-w-0 items-center gap-2 whitespace-nowrap"
      >
        {ticket ? (
          <>
            <Ticket className="text-label-2 size-3.5" aria-hidden />
            <span className="text-label truncate font-medium">{ticket.name}</span>
            {!compact ? <span className="text-label-3">Billet</span> : null}
          </>
        ) : table ? (
          <>
            <TierDot tier={table.tier} className="size-[7px]" />
            <span className="text-label font-medium">Table {table.label}</span>
            <span className="text-label-3 truncate">{table.zoneName}</span>
          </>
        ) : zone ? (
          <>
            <TierDot tier={zone.tier} className="size-[7px]" />
            <span className="text-label truncate font-medium">{zone.name}</span>
            {!compact ? (
              <span className="text-label-3">
                {zone.level === 0 ? "Rez-de-chaussée" : "Mezzanine"}
              </span>
            ) : null}
          </>
        ) : content.event.subtitle ? (
          // a billed night (DJ, artist): its name first, in capitals
          <>
            <span className="text-label truncate text-[14px] leading-none font-semibold tracking-[0.08em] uppercase">
              {content.event.name}
            </span>
            {!compact ? (
              <span className="num text-label-3">
                {content.event.subtitle} · {shortDate(dateLabel)}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span className="text-label-2 truncate">{content.event.name}</span>
            {!compact ? (
              <span className="num text-label-3">
                {shortDate(dateLabel)} · {content.event.doors.replace(":", "h")}
              </span>
            ) : null}
          </>
        )}
      </motion.span>
    </AnimatePresence>
  )
}

/**
 * The night's poster line on the overview, when the night is billed (`event.subtitle`): its name
 * in large capitals under the top bar, gone as soon as the buyer looks at a space or a table.
 */
export function EventHeadline({
  content,
  dateLabel,
  isDesktop,
}: {
  content: VenueContent
  dateLabel: string
  isDesktop: boolean
}) {
  const view = useExperience((s) => s.view)
  const panel = useExperience((s) => s.panel)
  const { subtitle } = content.event
  if (!subtitle) return null
  const shown = view === "overview" && (isDesktop || panel === null)
  return (
    <AnimatePresence>
      {shown ? (
        <motion.div
          key="headline"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "pointer-events-none absolute z-20 [text-shadow:0_2px_18px_rgb(0_0_0/0.85)]",
            isDesktop
              ? "top-[76px] left-5"
              : "top-[calc(max(0.75rem,env(safe-area-inset-top))+96px)] left-4",
          )}
        >
          <p
            className={cn(
              "text-label leading-[0.95] font-semibold tracking-[0.06em] uppercase",
              isDesktop ? "text-[46px]" : "text-[30px]",
            )}
          >
            {content.event.name}
          </p>
          <p className="eyebrow text-brand mt-2">
            {subtitle} · {dateLabel} · {content.event.doors.replace(":", "h")}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Top-left: back, club mark + wordmark, context, demo tag. */
export function BrandBar({
  content,
  brand,
  zones,
  table,
  ticket = null,
  dateLabel,
  isDesktop,
  compact = !isDesktop,
}: {
  content: VenueContent
  brand: ClubBrand
  zones: ZoneView[]
  table: TableView | null
  /** Standing area seen from inside, if any. */
  ticket?: TicketView | null
  dateLabel: string
  isDesktop: boolean
  /** Drop the secondary labels (level, date) when the bar shares the width. */
  compact?: boolean
}) {
  const view = useExperience((s) => s.view)
  const focusedZoneId = useExperience((s) => s.focusedZoneId)
  const resetView = useExperience((s) => s.resetView)
  const back = useExperience((s) => s.back)
  const zone = zones.find((z) => z.id === (table?.zoneId ?? focusedZoneId)) ?? null
  const canGoBack = view === "zone" || view === "table" || view === "seat" || view === "ticket"

  return (
    <div className="flex min-w-0 items-center gap-2">
      <AnimatePresence initial={false}>
        {canGoBack ? (
          <motion.div
            key="back"
            initial={{ opacity: 0, scale: 0.5, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: isDesktop ? 40 : 36 }}
            exit={{ opacity: 0, scale: 0.5, width: 0 }}
            transition={SOFT_SPRING}
            className="shrink-0"
          >
            <RoundBtn
              label="Retour"
              keys={isDesktop ? ["Esc"] : undefined}
              side="bottom"
              size={isDesktop ? "md" : "sm"}
              onClick={back}
              className={isDesktop ? "" : "size-9"}
            >
              <ChevronLeft />
            </RoundBtn>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <motion.div
        layout
        transition={SOFT_SPRING}
        className={cn(
          "glass glass-rim sober:rounded-[11px] relative flex min-w-0 items-center rounded-full",
          isDesktop ? "h-10 gap-3 pr-3 pl-4" : "h-9 gap-2.5 pr-3 pl-3.5",
        )}
      >
        <button
          type="button"
          onClick={resetView}
          aria-label={`${content.club.name} — vue d’ensemble`}
          className="text-label focus-visible:ring-brand/70 sober:rounded-[8px] flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2"
        >
          <Emblem emblem={brand.emblem} className={isDesktop ? "h-[13px]" : "h-3"} />
          <Wordmark
            name={content.club.name}
            wordmark={brand.wordmark}
            foil
            className={isDesktop ? "h-[12px]" : "h-[11px]"}
          />
        </button>
        <span aria-hidden className="h-4 w-px shrink-0 bg-white/[0.16]" />
        <Context
          content={content}
          zone={zone}
          table={table}
          ticket={view === "ticket" ? ticket : null}
          dateLabel={dateLabel}
          compact={compact}
        />
        {content.club.demo && isDesktop ? (
          <span
            title={content.club.disclaimer}
            className="eyebrow text-brand sober:rounded-[4px] ml-1 shrink-0 rounded-full px-2 py-[3px] text-[9px] leading-3 tracking-[0.22em] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_40%,transparent)]"
          >
            Démo
          </span>
        ) : null}
      </motion.div>
    </div>
  )
}

export function SearchButton({ isDesktop }: { isDesktop: boolean }) {
  const setCommandOpen = useExperience((s) => s.setCommandOpen)
  return (
    <RoundBtn
      label="Rechercher"
      keys={isDesktop ? ["⌘", "K"] : undefined}
      side="bottom"
      size={isDesktop ? "md" : "sm"}
      className={isDesktop ? "" : "size-9"}
      onClick={() => setCommandOpen(true)}
    >
      <Search />
    </RoundBtn>
  )
}

/** Night mode switch, for clubs whose ambiance offers it: dark room, one light colour, smoke. */
/** The night's music, as the immersion plays it. */
export interface NightMusic {
  url: string
  title: string
  artist?: string
  /** Sealed (`.enc`): it plays only from a private demo link carrying its key. */
  sealed?: boolean
}

/** The private demo link's key can arrive after the page: `#son=…` added to its address. */
function onHashChange(changed: () => void) {
  window.addEventListener("hashchange", changed)
  return () => window.removeEventListener("hashchange", changed)
}

/**
 * Three bars that dance on the music's beats, one after the other within each beat, as tall as
 * the music is full (still when motion is reduced).
 */
function Equalizer({ className }: { className?: string }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    const draw = () => {
      bars.current.forEach((bar, i) => {
        if (!bar) return
        const hit = show.on ? Math.exp(-((show.phase + 1 - i * 0.22) % 1) * 4) : pulse.beat
        const full = show.on ? show.energy : pulse.level
        bar.style.transform = `scaleY(${(0.3 + 0.7 * Math.min(1, hit * (0.55 + 0.45 * full))).toFixed(2)})`
      })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <span aria-hidden className={cn("flex h-3.5 items-end gap-[2px]", className)}>
      {[0.55, 0.85, 0.4].map((still, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el
          }}
          className="h-full w-[3px] origin-bottom rounded-[1px] bg-current"
          style={{ transform: `scaleY(${still})` }}
        />
      ))}
    </span>
  )
}

/**
 * Immersion, for clubs whose ambiance offers the night mode: the room falls dark in the night's
 * colour, smoke drifts over the floor and, when the visitor accepts it, the night's music plays
 * and the lights beat with it. The sound is asked for, never imposed.
 */
export function Immersion({ isDesktop, music }: { isDesktop: boolean; music: NightMusic | null }) {
  const night = useExperience((s) => s.night)
  const sound = useExperience((s) => s.sound)
  const setNight = useExperience((s) => s.setNight)
  const setSound = useExperience((s) => s.setSound)
  const notify = useExperience((s) => s.notify)
  const [asking, setAsking] = useState(false)
  // the music is offered only when it can play: its file is there and, sealed, the private
  // demo link carries its key (opened ahead, so that the click starts it at once)
  const [playable, setPlayable] = useState<string | null>(null)
  const linkKey = useSyncExternalStore(onHashChange, musicKey, () => null)
  useEffect(() => {
    if (!music) return
    const key = music.sealed ? linkKey : null
    if (music.sealed && !key) return
    let live = true
    const ready = key
      ? unsealMusic(music.url, key)
      : fetch(music.url, { method: "HEAD" }).then((res) => (res.ok ? music.url : null))
    ready.then((url) => live && setPlayable(url)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [music, linkKey])
  // a sealed track is already here: the show reads it once the club has opened (not while it
  // builds up), so that its lights keep time from the first beat; a plain one is read when the
  // visitor asks for it
  const opened = useExperience((s) => s.sceneReady && s.view !== "intro")
  useEffect(() => {
    if (playable && opened && music?.sealed) void prepareShow(playable)
  }, [playable, opened, music?.sealed])
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!asking) return
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)
      )
        setAsking(false)
    }
    window.addEventListener("keydown", close)
    window.addEventListener("pointerdown", close)
    return () => {
      window.removeEventListener("keydown", close)
      window.removeEventListener("pointerdown", close)
    }
  }, [asking])

  const offered = music && playable ? { ...music, url: playable } : null
  const credit = offered ? `${offered.title}${offered.artist ? ` — ${offered.artist}` : ""}` : null

  // started inside the click: the browser plays sound only after a gesture
  const start = (withSound: boolean) => {
    setAsking(false)
    setNight(true)
    const playing = withSound && offered ? playMusic(offered.url) : Promise.resolve(false)
    if (withSound && offered) void prepareShow(offered.url)
    void playing.then((on) => {
      setSound(on)
      track("night_mode_toggled", { on: true, sound: on })
      notify(
        on
          ? { tone: "brand", title: "Immersion", detail: credit ?? undefined }
          : { tone: "neutral", title: "Immersion", detail: "Mode nuit, sans le son" },
      )
    })
  }
  const stop = () => {
    pauseMusic()
    setNight(false)
    track("night_mode_toggled", { on: false, sound: false })
  }
  const toggleSound = () => {
    if (!offered) return
    if (sound) {
      pauseMusic()
      setSound(false)
      track("music_toggled", { on: false })
      return
    }
    void playMusic(offered.url).then((on) => {
      setSound(on)
      track("music_toggled", { on })
    })
    void prepareShow(offered.url)
  }

  return (
    <div ref={box} className="relative flex items-center gap-2">
      {night && offered ? (
        <RoundBtn
          label={sound ? "Couper le son" : "Mettre le son"}
          side="bottom"
          size={isDesktop ? "md" : "sm"}
          className={isDesktop ? "" : "size-9"}
          onClick={toggleSound}
        >
          {sound ? <Volume2 /> : <VolumeX />}
        </RoundBtn>
      ) : null}
      <button
        type="button"
        aria-pressed={night}
        aria-expanded={asking}
        aria-label={night ? "Quitter l’immersion" : "Immersion : la salle en mode nuit"}
        onClick={() => (night ? stop() : offered ? setAsking((open) => !open) : start(false))}
        className={cn(
          "sober:rounded-[11px] focus-visible:ring-brand/70 relative flex shrink-0 items-center gap-2 rounded-full font-medium transition-[background-color,box-shadow,transform] duration-200 outline-none focus-visible:ring-2 active:scale-[0.97] [&_svg]:size-4",
          isDesktop ? "h-10 px-4 text-[13px]" : "size-9 justify-center",
          night
            ? "brand-pill"
            : "glass glass-rim text-label shadow-[0_0_0_1px_color-mix(in_srgb,var(--brand)_55%,transparent),0_0_18px_color-mix(in_srgb,var(--brand)_35%,transparent)] hover:bg-white/[0.12]",
        )}
      >
        {night && sound ? <Equalizer /> : <AudioLines className={night ? "" : "text-brand"} />}
        {isDesktop ? <span>Immersion</span> : null}
      </button>
      <AnimatePresence>
        {asking && offered ? (
          <motion.div
            role="dialog"
            aria-label="Immersion"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="glass-thick glass-rim sober:rounded-[14px] absolute top-[calc(100%+10px)] right-0 z-50 w-[min(300px,calc(100vw-1.5rem))] origin-top-right rounded-[22px] p-4"
          >
            <p className="text-label text-[15px] font-semibold">Immersion</p>
            <p className="text-footnote text-label-2 mt-1">
              La salle passe en mode nuit, au son de la soirée
              {credit ? <span className="text-label">{`\u00a0: ${credit}`}</span> : null}.
            </p>
            <div className="mt-3.5 flex gap-2">
              <Btn variant="brand" size="sm" autoFocus onClick={() => start(true)}>
                <Volume2 />
                Avec le son
              </Btn>
              <Btn size="sm" onClick={() => start(false)}>
                Sans le son
              </Btn>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "glass glass-rim text-caption text-label-2 sober:rounded-[10px] relative flex h-9 items-center gap-3.5 rounded-full px-4",
        className,
      )}
    >
      {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <StatusIcon status={key} className="size-3" />
          {STATUS[key].label}
        </li>
      ))}
    </ul>
  )
}

const contactLink =
  "text-label-2 hover:text-label inline-flex items-center gap-1.5 transition-colors"

/** The club's own channels, for a question or when something fails: WhatsApp first. */
export function FallbackContact({
  club,
  eventName,
  tableLabel,
  context,
  className,
}: {
  club: VenueContent["club"]
  /** Night named in the WhatsApp message. */
  eventName: string
  /** Table named in the WhatsApp message, if any. */
  tableLabel?: string
  context: string
  className?: string
}) {
  const { whatsapp, instagram: ig, phone, email } = club.contact
  if (!whatsapp && !ig && !phone && !email) return null
  const message = contactMessage({ clubName: club.name, eventName, tableLabel })
  return (
    <div className={cn("text-footnote flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <span className="text-label-3">Une question, un groupe ?</span>
      {whatsapp ? (
        <a
          href={whatsappUrl(whatsapp, message)}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("fallback_contact_clicked", { channel: "whatsapp", context })}
          className={contactLink}
        >
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
      ) : null}
      {ig ? (
        <a
          href={instagramUrl(ig)}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("fallback_contact_clicked", { channel: "instagram", context })}
          className={contactLink}
        >
          <MessageCircle className="size-3.5" /> Instagram
        </a>
      ) : null}
      {phone ? (
        <a
          href={phoneUrl(phone)}
          onClick={() => track("fallback_contact_clicked", { channel: "phone", context })}
          className={contactLink}
        >
          <Phone className="size-3.5" /> {phone}
        </a>
      ) : null}
      {email ? (
        <a
          href={`mailto:${email}`}
          onClick={() => track("fallback_contact_clicked", { channel: "email", context })}
          className={contactLink}
        >
          <Mail className="size-3.5" /> {email}
        </a>
      ) : null}
    </div>
  )
}

/** Round link to the club's WhatsApp, with a first message naming the night and the table. */
export function WhatsAppButton({
  club,
  eventName,
  tableLabel,
  context,
}: {
  club: VenueContent["club"]
  eventName: string
  tableLabel?: string
  context: string
}) {
  const number = club.contact.whatsapp
  if (!number) return null
  const label = `Écrire à ${club.name} sur WhatsApp`
  return (
    <Hint label={label} side="bottom">
      <a
        href={whatsappUrl(number, contactMessage({ clubName: club.name, eventName, tableLabel }))}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        onClick={() => track("fallback_contact_clicked", { channel: "whatsapp", context })}
        className="glass glass-rim text-label focus-visible:ring-brand/70 sober:rounded-[10px] relative grid size-9 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-200 outline-none hover:bg-white/[0.12] focus-visible:ring-2 active:scale-95 [&_svg]:size-4"
      >
        <MessageCircle />
      </a>
    </Hint>
  )
}

/** Hint + exit while looking around from a seat; on phones it also carries the CTA. */
export function SeatOverlay({
  table,
  canRequest,
}: {
  table: TableView | null
  canRequest: boolean
}) {
  const view = useExperience((s) => s.view)
  const leaveSeat = useExperience((s) => s.leaveSeat)
  const openDialog = useExperience((s) => s.openDialog)
  return (
    <AnimatePresence>
      {view === "seat" && table ? (
        <motion.div
          key="seat"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* under the top bar, on every screen: the immersion's buttons stay at hand */}
          <div className="pointer-events-none absolute inset-x-0 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] z-30 flex justify-center px-3">
            <motion.div
              initial={{ y: -12, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              transition={SOFT_SPRING}
              className="glass glass-rim text-footnote sober:rounded-[12px] pointer-events-auto relative flex h-11 items-center gap-3 rounded-full pr-1.5 pl-4"
            >
              <ScanEye className="text-brand size-4" />
              <span className="text-label truncate">
                Vue depuis la table {table.label}
                <span className="text-label-3 hidden sm:inline">
                  {" "}
                  · glissez pour regarder autour
                </span>
              </span>
              <Btn size="sm" onClick={leaveSeat}>
                Quitter <Kbd className="hidden sm:inline-flex">Esc</Kbd>
              </Btn>
            </motion.div>
          </div>
          {canRequest ? (
            <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30">
              <Btn
                variant="brand"
                size="lg"
                className="w-full"
                onClick={() => openDialog("request")}
              >
                Demander la table {table.label}
              </Btn>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
