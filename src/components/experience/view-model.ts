import type { TableMarkerData, ZoneMarkerData } from "@/components/scene/markers"
import { formatEuro } from "@/lib/format"
import type { VenueContent } from "@/lib/schema"
import { tableLevel, type Level, type TableKind, type VenueLayout } from "@/lib/venue/layout"
import { pricePerPerson } from "@/lib/venue/offers"
import { TIERS, type TableStatus } from "@/lib/venue/tiers"

export interface TableView {
  id: string
  label: string
  zoneId: string
  zoneName: string
  tier: TableKind
  level: Level
  capacity: { min: number; max: number }
  minimumSpend: number | null
  perPerson: number | null
  status: TableStatus
  perks: string[]
  view: string
}

export interface ZoneView {
  id: string
  name: string
  shortName: string
  description: string
  tier: TableKind
  level: Level
  perks: string[]
  fromMinimum: number | null
  fromPerPerson: number | null
  available: number
  total: number
  tables: TableView[]
}

export interface ViewModel {
  zones: ZoneView[]
  tables: Record<string, TableView>
  zoneMarkers: ZoneMarkerData[]
  tableMarkers: TableMarkerData[]
}

const minOf = (values: (number | null)[]) => {
  const xs = values.filter((v): v is number => v !== null)
  return xs.length ? Math.min(...xs) : null
}

/** Joins the commercial content (prices, statuses) with the venue geometry (zones, levels). */
export function buildViewModel(content: VenueContent, layout: VenueLayout): ViewModel {
  const layoutTables = new Map(layout.tables.map((t) => [t.id, t]))
  const zoneContent = new Map(content.zones.map((z) => [z.id, z]))

  const tables: Record<string, TableView> = {}
  for (const t of content.tables) {
    const lt = layoutTables.get(t.id)
    const lz = layout.zones.find((z) => z.id === t.zoneId)
    if (!lt || !lz) continue
    const perks = [...(zoneContent.get(t.zoneId)?.perks ?? []), ...t.perks]
    tables[t.id] = {
      id: t.id,
      label: t.label,
      zoneId: t.zoneId,
      zoneName: zoneContent.get(t.zoneId)?.name ?? t.zoneId,
      tier: lz.tier,
      level: tableLevel(layout, lt),
      capacity: t.capacity,
      minimumSpend: t.minimumSpend,
      perPerson: pricePerPerson(t),
      status: t.status,
      perks,
      view: t.view,
    }
  }

  const zones: ZoneView[] = layout.zones
    .map((lz) => {
      const zc = zoneContent.get(lz.id)
      const zoneTables = Object.values(tables).filter((t) => t.zoneId === lz.id)
      const open = zoneTables.filter((t) => t.status !== "sold")
      return {
        id: lz.id,
        name: zc?.name ?? lz.id,
        shortName: zc?.shortName ?? lz.id,
        description: zc?.description ?? "",
        tier: lz.tier,
        level: lz.level,
        perks: zc?.perks ?? [],
        fromMinimum: minOf(open.map((t) => t.minimumSpend)),
        fromPerPerson: minOf(open.map((t) => t.perPerson)),
        available: zoneTables.filter((t) => t.status === "available").length,
        total: zoneTables.length,
        tables: zoneTables,
      }
    })
    .sort((a, b) => TIERS[a.tier].order - TIERS[b.tier].order)

  return {
    zones,
    tables,
    zoneMarkers: zones.map((z) => ({
      id: z.id,
      name: z.name,
      tier: z.tier,
      level: z.level,
      fromLabel: z.fromMinimum !== null ? formatEuro(z.fromMinimum) : null,
      available: z.available,
      total: z.total,
    })),
    tableMarkers: Object.values(tables).map((t) => ({
      id: t.id,
      label: t.label,
      zoneId: t.zoneId,
      level: t.level,
      priceLabel: t.minimumSpend !== null ? formatEuro(t.minimumSpend) : null,
      status: t.status,
    })),
  }
}
