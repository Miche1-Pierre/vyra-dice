"use client"

import { ChevronLeft, Mail, MessageCircle, Phone, ScanEye, Search, Ticket } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

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
    <div className={cn("glass glass-rim relative rounded-full p-1", className)}>
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
          "glass glass-rim relative flex min-w-0 items-center rounded-full",
          isDesktop ? "h-10 gap-3 pr-3 pl-4" : "h-9 gap-2.5 pr-3 pl-3.5",
        )}
      >
        <button
          type="button"
          onClick={resetView}
          aria-label={`${content.club.name} — vue d’ensemble`}
          className="text-label focus-visible:ring-brand/70 flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2"
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
            className="eyebrow text-brand ml-1 shrink-0 rounded-full px-2 py-[3px] text-[9px] leading-3 tracking-[0.22em] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_40%,transparent)]"
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

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "glass glass-rim text-caption text-label-2 relative flex h-9 items-center gap-3.5 rounded-full px-4",
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
        className="glass glass-rim text-label focus-visible:ring-brand/70 relative grid size-9 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-200 outline-none hover:bg-white/[0.12] focus-visible:ring-2 active:scale-95 [&_svg]:size-4"
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
          <div className="pointer-events-none absolute inset-x-0 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] z-30 flex justify-center px-3 lg:top-4">
            <motion.div
              initial={{ y: -12, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              transition={SOFT_SPRING}
              className="glass glass-rim text-footnote pointer-events-auto relative flex h-11 items-center gap-3 rounded-full pr-1.5 pl-4"
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
