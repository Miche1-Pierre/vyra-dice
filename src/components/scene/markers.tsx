"use client"

import { Html } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef, type Ref } from "react"
import * as THREE from "three"

import { cn } from "@/lib/utils"
import { useExperience } from "@/lib/store"
import { tableMarkerPosition, zoneMarkerPosition } from "@/lib/venue/camera"
import type { VenueLayout } from "@/lib/venue/layout"
import { STATUS, TIERS, type TableStatus } from "@/lib/venue/tiers"
import type { TableKind } from "@/lib/venue/layout"

export interface ZoneMarkerData {
  id: string
  name: string
  tier: TableKind
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

  if (view === "intro" || view === "seat") return null

  return (
    <>
      {view === "overview" &&
        zones
          .filter((z) => levelVisible(z.level))
          .map((z) => (
            <Html
              key={z.id}
              position={zonePositions[z.id]}
              zIndexRange={[30, 10]}
              style={{ pointerEvents: "none" }}
            >
              <ZoneTag
                zone={z}
                onClick={() => focusZone(z.id)}
                cardRef={register(`zone:${z.id}`)}
              />
            </Html>
          ))}
      {(view === "zone" || view === "table") &&
        tables
          .filter((t) => (view === "zone" ? t.zoneId === focusedZoneId : t.id === selectedTableId))
          .filter((t) => levelVisible(t.level))
          .map((t) => (
            <Html
              key={t.id}
              position={tablePositions[t.id]}
              zIndexRange={[30, 10]}
              style={{ pointerEvents: "none" }}
            >
              <TableTag
                table={t}
                tier={zones.find((z) => z.id === t.zoneId)?.tier ?? "lounge"}
                active={t.id === selectedTableId || t.id === hoveredTableId}
                onClick={() => selectTable(t.id)}
                onHover={(on) => hoverTable(on ? t.id : null)}
                cardRef={register(`table:${t.id}`)}
              />
            </Html>
          ))}
    </>
  )
}

/** Screen margins and stem sizes used by the card layout (px). */
const EDGE = 10
const GAP = 4
const ZONE_STEM = 32 // 20 px line + 12 px dot
const TABLE_STEM = 12

function Stem({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-px bg-white/60" style={{ height: "calc(20px + var(--lift, 0px))" }} />
      <div
        className="size-3 rounded-full border-2 border-white/90 shadow-[0_0_12px_currentColor]"
        style={{ backgroundColor: color, color }}
      />
    </div>
  )
}

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
        className="group pointer-events-auto relative rounded-lg border border-white/15 bg-black/75 px-2.5 py-1.5 text-left whitespace-nowrap shadow-xl backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/40 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        style={{ boxShadow: `0 0 0 1px ${tier.color}22, 0 10px 30px -10px ${tier.color}88` }}
      >
        <span className="font-heading flex items-center gap-1.5 text-[13px] font-semibold text-white">
          <span className="inline-block size-2 rounded-full" style={{ background: tier.color }} />
          {zone.name}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/65">
          <span className="font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase max-sm:hidden">
            {zone.level === 0 ? "RDC" : "Mezz."}
          </span>
          {zone.fromLabel ? <span className="text-white">dès {zone.fromLabel}</span> : null}
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ background: STATUS[zone.availability.tone].color }}
          />
          <span className="max-sm:hidden">{zone.availability.label}</span>
        </span>
      </button>
      <Stem color={tier.color} />
    </div>
  )
}

function TableTag({
  table,
  tier,
  active,
  onClick,
  onHover,
  cardRef,
}: {
  table: TableMarkerData
  tier: TableKind
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
        className={cn(
          "pointer-events-auto relative flex items-center gap-2 rounded-full border bg-black/80 py-1 pr-3 pl-1 whitespace-nowrap shadow-lg backdrop-blur-md transition focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none",
          active ? "scale-105 border-white/70" : "border-white/15 hover:border-white/40",
          table.status === "sold" && "opacity-70",
        )}
      >
        <span
          className="grid size-6 place-items-center rounded-full text-[11px] font-bold text-black"
          style={{ background: TIERS[tier].color }}
        >
          {table.label}
        </span>
        <span className="text-xs font-medium text-white">
          {table.status === "sold" ? "Complet" : (table.priceLabel ?? "Sur demande")}
        </span>
        <span className="inline-block size-1.5 rounded-full" style={{ background: status.color }} />
      </button>
      <div className="w-px bg-white/50" style={{ height: "calc(12px + var(--lift, 0px))" }} />
    </div>
  )
}
