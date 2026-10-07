"use client"

import { Html } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef, type Ref } from "react"
import * as THREE from "three"

import { cn } from "@/lib/utils"
import { useExperience } from "@/lib/store"
import { tableMarkerPosition, zoneMarkerPosition } from "@/lib/venue/camera"
import type { VenueLayout } from "@/lib/venue/layout"
import { StatusIcon, ZoneTile } from "@/components/experience/ui"
import type { ZoneIcon } from "@/lib/schema"
import { STATUS, TIERS, type TableStatus } from "@/lib/venue/tiers"
import type { TableKind } from "@/lib/venue/layout"

export interface ZoneMarkerData {
  id: string
  name: string
  tier: TableKind
  icon: ZoneIcon
  level: 0 | 1
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

/** Price tags floating in the scene: one per zone on the overview, one per table inside a zone. */
export function Markers({
  layout,
  zones,
  tables,
}: {
  layout: VenueLayout
  zones: ZoneMarkerData[]
  tables: TableMarkerData[]
}) {
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
      const p = kind === "zone" ? zonePositions[id] : tablePositions[id]
      if (!p) continue
      projected.set(p[0], p[1], p[2]).project(camera)
      const x = ((projected.x + 1) / 2) * size.width
      const y = ((1 - projected.y) / 2) * size.height
      const w = el.offsetWidth
      const half = w / 2
      let shift = 0
      if (x - half < EDGE) shift = EDGE - (x - half)
      else if (x + half > size.width - EDGE) shift = size.width - EDGE - (x + half)
      const stem = kind === "zone" ? ZONE_STEM : TABLE_STEM
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
      (view === "table" && t.id === selectedTableId)) &&
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
        style={{ backgroundColor: color, boxShadow: `0 0 10px 2px ${color}aa` }}
      />
    </div>
  )
}

const chip =
  "pointer-events-auto relative whitespace-nowrap text-left outline-none transition-[transform,box-shadow,background-color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-gold/80"

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
        aria-label={`${zone.name}, ${tier.label}, ${zone.fromLabel ? `dès ${zone.fromLabel}, ` : ""}${zone.availability.label}`}
        className={cn(
          chip,
          "flex items-center gap-2.5 rounded-full bg-[rgb(16_13_20/0.8)] py-1 pr-3.5 pl-1 shadow-[0_0_0_1px_rgb(255_255_255/0.11),inset_0_1px_0_rgb(255_255_255/0.08),0_10px_28px_rgb(0_0_0/0.55)] backdrop-blur-md hover:scale-[1.05] hover:bg-[rgb(26_22_32/0.9)]",
        )}
      >
        <ZoneTile tier={zone.tier} icon={zone.icon} className="size-7 rounded-full" />
        <span className="leading-tight">
          <span className="text-label block text-[13px] leading-4 font-semibold">{zone.name}</span>
          <span className="num text-label-2 mt-px flex items-center gap-1.5 text-[11px] leading-[14px]">
            {zone.fromLabel ? <span>dès {zone.fromLabel}</span> : null}
            <span className="flex items-center gap-1 max-sm:hidden">
              <StatusIcon status={zone.availability.tone} className="size-[11px]" />
              {zone.availability.label}
            </span>
          </span>
        </span>
      </button>
      <Stem color={tier.color} height={22} />
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
        aria-label={`Table ${table.label}, ${status.label}${table.priceLabel ? `, minimum ${table.priceLabel}` : ""}`}
        className={cn(
          chip,
          "flex h-7 items-center gap-1.5 rounded-full bg-[rgb(16_13_20/0.86)] pr-3 pl-1 text-[12px]",
          active
            ? "scale-[1.08] shadow-[0_0_0_1.5px_#e8c27a,0_0_22px_rgb(232_194_122/0.45),0_8px_22px_rgb(0_0_0/0.55)]"
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
