"use client"

import { Html } from "@react-three/drei"
import { useMemo } from "react"

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
              <ZoneTag zone={z} onClick={() => focusZone(z.id)} />
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
              />
            </Html>
          ))}
    </>
  )
}

function Stem({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-5 w-px bg-white/60" />
      <div
        className="size-3 rounded-full border-2 border-white/90 shadow-[0_0_12px_currentColor]"
        style={{ backgroundColor: color, color }}
      />
    </div>
  )
}

function ZoneTag({ zone, onClick }: { zone: ZoneMarkerData; onClick: () => void }) {
  const tier = TIERS[zone.tier]
  const soldOut = zone.available === 0
  return (
    <div className="pointer-events-none flex -translate-x-1/2 -translate-y-full flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        className="group pointer-events-auto rounded-lg border border-white/15 bg-black/75 px-3 py-2 text-left whitespace-nowrap shadow-xl backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/40 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
        style={{ boxShadow: `0 0 0 1px ${tier.color}22, 0 10px 30px -10px ${tier.color}88` }}
      >
        <span className="block font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">
          <span
            className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full"
            style={{ background: tier.color }}
          />
          {tier.label} · {zone.level === 0 ? "RDC" : "Mezzanine"}
        </span>
        <span className="font-heading block text-sm font-semibold text-white">{zone.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70">
          {zone.fromLabel ? <span className="text-white">dès {zone.fromLabel}</span> : null}
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ background: soldOut ? STATUS.sold.color : STATUS.available.color }}
          />
          {soldOut ? "Complet" : `${zone.available}/${zone.total} tables`}
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
}: {
  table: TableMarkerData
  tier: TableKind
  active: boolean
  onClick: () => void
  onHover: (on: boolean) => void
}) {
  const status = STATUS[table.status]
  return (
    <div className="pointer-events-none flex -translate-x-1/2 -translate-y-full flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full border bg-black/80 py-1 pr-3 pl-1 whitespace-nowrap shadow-lg backdrop-blur-md transition focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none",
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
      <div className="h-3 w-px bg-white/50" />
    </div>
  )
}
