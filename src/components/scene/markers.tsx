"use client"

import { Html } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef, type Ref } from "react"
import * as THREE from "three"

import { cn } from "@/lib/utils"
import { useExperience } from "@/lib/store"
import { standingMarkerPosition, tableMarkerPosition, zoneMarkerPosition } from "@/lib/venue/camera"
import type { VenueLayout } from "@/lib/venue/layout"
import { Ticket } from "lucide-react"

import { StatusIcon, Tile, ZoneTile } from "@/components/experience/ui"
import type { ZoneIcon } from "@/lib/schema"
import { STATUS, TIERS, tierColor, withAlpha, type TableStatus } from "@/lib/venue/tiers"
import type { TableKind } from "@/lib/venue/layout"

export interface ZoneMarkerData {
  id: string
  name: string
  tier: TableKind
  icon: ZoneIcon
  level: 0 | 1
  /** "dès 350 €", "prix sur demande", or nothing when the availability already says it all. */
  fromLabel: string | null
  available: number
  total: number
  availability: { label: string; tone: TableStatus }
}

export interface TableMarkerData {
  id: string
  label: string
  zoneId: string
  level: 0 | 1
  priceLabel: string | null
  status: TableStatus
}

export interface TicketMarkerData {
  id: string
  name: string
  level: 0 | 1
  /** "dès 15 €". */
  priceLabel: string
}

/**
 * Price tags floating in the scene: one per zone and per standing area on the overview, one per
 * table inside a zone.
 */
export function Markers({
  layout,
  zones,
  tables,
  tickets = [],
}: {
  layout: VenueLayout
  zones: ZoneMarkerData[]
  tables: TableMarkerData[]
  tickets?: TicketMarkerData[]
}) {
  const focusTicket = useExperience((s) => s.focusTicket)
  const view = useExperience((s) => s.view)
  const focusedZoneId = useExperience((s) => s.focusedZoneId)
  const selectedTableId = useExperience((s) => s.selectedTableId)
  const hoveredTableId = useExperience((s) => s.hoveredTableId)
  const levelFilter = useExperience((s) => s.levelFilter)
  const focusZone = useExperience((s) => s.focusZone)
  const selectTable = useExperience((s) => s.selectTable)
  const hoverTable = useExperience((s) => s.hoverTable)

  const zonePositions = useMemo(
    () => Object.fromEntries(zones.map((z) => [z.id, zoneMarkerPosition(layout, z.id)])),
    [layout, zones],
  )
  const ticketPositions = useMemo(
    () => Object.fromEntries(tickets.map((t) => [t.id, standingMarkerPosition(layout, t.id)])),
    [layout, tickets],
  )
  const tablePositions = useMemo(
    () =>
      Object.fromEntries(layout.tables.map((t) => [t.id, tableMarkerPosition(layout, t)] as const)),
    [layout],
  )

  const levelVisible = (level: 0 | 1) => levelFilter === "all" || levelFilter === level

  // Screen-space layout of the cards, every frame:
  // 1. slide a card horizontally to keep it on screen (its stem stays on the anchor);
  // 2. if two cards overlap, lift the farther one and stretch its stem.
  const cards = useRef(new Map<string, HTMLElement>())
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const projected = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const items: {
      el: HTMLElement
      left: number
      right: number
      bottom: number
      h: number
      z: number
      shift: number
      lift: number
    }[] = []
    for (const [key, el] of cards.current) {
      const [kind, id] = key.split(":")
      const p =
        kind === "zone"
          ? zonePositions[id]
          : kind === "ticket"
            ? ticketPositions[id]
            : tablePositions[id]
      if (!p) continue
      projected.set(p[0], p[1], p[2]).project(camera)
      const x = ((projected.x + 1) / 2) * size.width
      const y = ((1 - projected.y) / 2) * size.height
      const w = el.offsetWidth
      const half = w / 2
      let shift = 0
      if (x - half < EDGE) shift = EDGE - (x - half)
      else if (x + half > size.width - EDGE) shift = size.width - EDGE - (x + half)
      const stem = kind === "table" ? TABLE_STEM : ZONE_STEM
      items.push({
        el,
        left: x - half + shift,
        right: x + half + shift,
        bottom: y - stem,
        h: el.offsetHeight,
        z: projected.z,
        shift,
        lift: 0,
      })
    }
    items.sort((a, b) => a.z - b.z) // the nearest card keeps its place
    for (let i = 1; i < items.length; i++) {
      const a = items[i]
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < i; j++) {
          const b = items[j]
          const aBottom = a.bottom - a.lift
          const bBottom = b.bottom - b.lift
          const bTop = bBottom - b.h
          const overlapX = a.left < b.right + GAP && b.left < a.right + GAP
          const overlapY = aBottom - a.h < bBottom + GAP && bTop < aBottom + GAP
          if (overlapX && overlapY) a.lift += aBottom - (bTop - GAP)
        }
      }
    }
    for (const it of items) {
      it.el.style.left = `${Math.round(it.shift)}px`
      it.el.parentElement?.style.setProperty("--lift", `${Math.max(0, Math.round(it.lift))}px`)
    }
  })
  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) cards.current.set(key, el)
    else cards.current.delete(key)
  }

  // Every tag stays mounted and is only hidden: drei's <Html> owns a React root per tag, and
  // unmounting those roots while the scene re-renders makes React warn (and costs remounts).
  const zoneShown = (z: ZoneMarkerData) => view === "overview" && levelVisible(z.level)
  const tableShown = (t: TableMarkerData) =>
    ((view === "zone" && t.zoneId === focusedZoneId) ||
      (view === "table" && t.id === selectedTableId) ||
      // a table pointed at in the list (or hovered in 3D) shows its tag from any view
      (t.id === hoveredTableId && view !== "intro" && view !== "seat")) &&
    levelVisible(t.level)
  const wrapper = (shown: boolean) => ({
    pointerEvents: "none" as const,
    opacity: shown ? 1 : 0,
    visibility: shown ? ("visible" as const) : ("hidden" as const),
    transition: "opacity 220ms ease",
  })

  return (
    <>
      {zones.map((z) => {
        const shown = zoneShown(z)
        return (
          <Html
            key={z.id}
            position={zonePositions[z.id]}
            zIndexRange={[30, 10]}
            style={wrapper(shown)}
          >
            <ZoneTag
              zone={z}
              onClick={() => focusZone(z.id)}
              cardRef={shown ? register(`zone:${z.id}`) : null}
            />
          </Html>
        )
      })}
      {tickets.map((t) => {
        const shown = view === "overview" && levelVisible(t.level)
        return (
          <Html
            key={`ticket-${t.id}`}
            position={ticketPositions[t.id]}
            zIndexRange={[30, 10]}
            style={wrapper(shown)}
          >
            <TicketTag
              ticket={t}
              onClick={() => focusTicket(t.id)}
              cardRef={shown ? register(`ticket:${t.id}`) : null}
            />
          </Html>
        )
      })}
      {tables.map((t) => {
        const shown = tableShown(t)
        return (
          <Html
            key={t.id}
            position={tablePositions[t.id]}
            zIndexRange={[30, 10]}
            style={wrapper(shown)}
          >
            <TableTag
              table={t}
              active={t.id === selectedTableId || t.id === hoveredTableId}
              onClick={() => selectTable(t.id)}
              onHover={(on) => hoverTable(on ? t.id : null)}
              cardRef={shown ? register(`table:${t.id}`) : null}
            />
          </Html>
        )
      })}
    </>
  )
}

/** Screen margins and stem sizes used by the card layout (px). */
const EDGE = 12
const GAP = 6
const ZONE_STEM = 30 // 22 px line + 8 px pin
const TABLE_STEM = 12

function Stem({ color, height }: { color: string; height: number }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-px bg-gradient-to-b from-white/60 to-white/10"
        style={{ height: `calc(${height}px + var(--lift, 0px))` }}
      />
      <div
        className="size-2 rounded-full ring-[1.5px] ring-black/70"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 10px 2px ${withAlpha(color, 0xaa / 255)}`,
        }}
      />
    </div>
  )
}

const chip =
  "pointer-events-auto relative whitespace-nowrap text-left outline-none transition-[transform,box-shadow,background-color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-brand/80"

function ZoneTag({
  zone,
  onClick,
  cardRef,
}: {
  zone: ZoneMarkerData
  onClick: () => void
  cardRef: Ref<HTMLButtonElement>
}) {
  const tier = TIERS[zone.tier]
  return (
    <div className="pointer-events-none flex -translate-x-1/2 -translate-y-full flex-col items-center">
      <button
        ref={cardRef}
        type="button"
        onClick={onClick}
        aria-label={`${zone.name}, ${tier.label}, ${zone.fromLabel ? `${zone.fromLabel}, ` : ""}${zone.availability.label}`}
        className={cn(
          chip,
          "sober:rounded-[10px] flex items-center gap-2.5 rounded-full bg-[rgb(16_13_20/0.8)] py-1 pr-3.5 pl-1 shadow-[0_0_0_1px_rgb(255_255_255/0.11),inset_0_1px_0_rgb(255_255_255/0.08),0_10px_28px_rgb(0_0_0/0.55)] backdrop-blur-md hover:scale-[1.05] hover:bg-[rgb(26_22_32/0.9)]",
        )}
      >
        <ZoneTile
          tier={zone.tier}
          icon={zone.icon}
          className="sober:rounded-[7px] size-7 rounded-full"
        />
        <span className="leading-tight">
          <span className="text-label block text-[13px] leading-4 font-semibold">{zone.name}</span>
          {/* very short screens (phones held sideways): name only, the price is in the dock */}
          <span className="num text-label-2 mt-px flex items-center gap-1.5 text-[11px] leading-[14px] [@media(max-height:499px)]:hidden">
            {zone.fromLabel ? <span>{zone.fromLabel}</span> : null}
            <span className="flex items-center gap-1 max-sm:hidden">
              <StatusIcon status={zone.availability.tone} className="size-[11px]" />
              {zone.availability.label}
            </span>
          </span>
        </span>
      </button>
      <Stem color={tierColor(zone.tier)} height={22} />
    </div>
  )
}

function TicketTag({
  ticket,
  onClick,
  cardRef,
}: {
  ticket: TicketMarkerData
  onClick: () => void
  cardRef: Ref<HTMLButtonElement>
}) {
  return (
    <div className="pointer-events-none flex -translate-x-1/2 -translate-y-full flex-col items-center">
      <button
        ref={cardRef}
        type="button"
        onClick={onClick}
        aria-label={`${ticket.name}, billet sans table, ${ticket.priceLabel} par personne`}
        className={cn(
          chip,
          "sober:rounded-[10px] flex items-center gap-2.5 rounded-full bg-[rgb(16_13_20/0.8)] py-1 pr-3.5 pl-1 shadow-[0_0_0_1px_rgb(255_255_255/0.11),inset_0_1px_0_rgb(255_255_255/0.08),0_10px_28px_rgb(0_0_0/0.55)] backdrop-blur-md hover:scale-[1.05] hover:bg-[rgb(26_22_32/0.9)]",
        )}
      >
        <Tile tone="graphite" className="sober:rounded-[7px] size-7 rounded-full">
          <Ticket />
        </Tile>
        <span className="leading-tight">
          <span className="text-label block text-[13px] leading-4 font-semibold">
            {ticket.name}
          </span>
          <span className="num text-label-2 mt-px block text-[11px] leading-[14px] [@media(max-height:499px)]:hidden">
            Billet · {ticket.priceLabel}
          </span>
        </span>
      </button>
      <Stem color="rgb(255 255 255 / 0.7)" height={22} />
    </div>
  )
}

function TableTag({
  table,
  active,
  onClick,
  onHover,
  cardRef,
}: {
  table: TableMarkerData
  active: boolean
  onClick: () => void
  onHover: (on: boolean) => void
  cardRef: Ref<HTMLButtonElement>
}) {
  const status = STATUS[table.status]
  return (
    <div className="pointer-events-none flex -translate-x-1/2 -translate-y-full flex-col items-center">
      <button
        ref={cardRef}
        type="button"
        onClick={onClick}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        aria-label={`Table ${table.label}, ${status.label}${table.priceLabel ? `, minimum ${table.priceLabel}` : ""}`}
        className={cn(
          chip,
          "sober:rounded-[8px] flex h-7 items-center gap-1.5 rounded-full bg-[rgb(16_13_20/0.86)] pr-3 pl-1 text-[12px]",
          active
            ? "scale-[1.08] shadow-[0_0_0_1.5px_var(--brand),0_0_22px_color-mix(in_srgb,var(--brand)_45%,transparent),0_8px_22px_rgb(0_0_0/0.55)]"
            : "shadow-[0_0_0_1px_rgb(255_255_255/0.12),0_8px_22px_rgb(0_0_0/0.5)] hover:scale-[1.06]",
        )}
      >
        <span
          className="grid size-5 place-items-center rounded-full"
          style={{ background: `${status.color}26` }}
        >
          <StatusIcon status={table.status} className="size-3" />
        </span>
        <span className="text-label font-semibold">{table.label}</span>
        <span
          className={cn(
            "num",
            table.status === "sold" ? "text-label-3 line-through" : "text-label-2",
          )}
        >
          {table.priceLabel ?? "sur demande"}
        </span>
      </button>
      <div
        className="w-px bg-gradient-to-b from-white/55 to-white/10"
        style={{ height: "calc(12px + var(--lift, 0px))" }}
      />
    </div>
  )
}
