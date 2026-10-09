import type { TableMarkerData, TicketMarkerData, ZoneMarkerData } from "@/components/scene/markers"
import { ticketingSite } from "@/lib/contact"
import { formatEuro } from "@/lib/format"
import type { Deposit, Surcharge, VenueContent, ZoneIcon } from "@/lib/schema"
import { tableLevel, type Level, type TableKind, type VenueLayout } from "@/lib/venue/layout"
import { pricePerPerson, type Quote } from "@/lib/venue/offers"
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
  /** Share of the minimum for a full table. */
  perPerson: number | null
  surcharge?: Surcharge
  deposit?: Deposit
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
  /** Dock / tag glyph; tiers have a default. */
  icon: ZoneIcon
  level: Level
  perks: string[]
  fromMinimum: number | null
  fromPerPerson: number | null
  available: number
  total: number
  /** Short availability wording shared by the sidebar, the tags and the dock. */
  availability: { label: string; tone: TableStatus }
  tables: TableView[]
}

/** Standing area sold on the ticketing site. */
export interface TicketView {
  id: string
  name: string
  shortName: string
  description: string
  fromPrice: number
  /** Ticketing page of this ticket. */
  url: string
  /** Name of the ticketing site, for its link ("Shotgun"). */
  site: string
  level: Level
}

export interface ViewModel {
  zones: ZoneView[]
  tables: Record<string, TableView>
  tickets: TicketView[]
  zoneMarkers: ZoneMarkerData[]
  tableMarkers: TableMarkerData[]
  ticketMarkers: TicketMarkerData[]
}

const DEFAULT_ICON: Record<TableKind, ZoneIcon> = {
  lounge: "sofa",
  vip: "sunrise",
  prestige: "crown",
}

const minOf = (values: (number | null)[]) => {
  const xs = values.filter((v): v is number => v !== null)
  return xs.length ? Math.min(...xs) : null
}

/** Minimum spend of a table, or "sur demande" when the club gives the price on request. */
export function minimumLabel(minimumSpend: number | null): string {
  return minimumSpend !== null ? formatEuro(minimumSpend) : "sur demande"
}

/**
 * "dès 350 €", or why a zone has no "from" price: "sur demande" while some of its tables are still
 * open without a price, "complet" once every table is sold.
 */
export function zonePriceLabel(zone: Pick<ZoneView, "fromMinimum" | "availability">): string {
  if (zone.fromMinimum !== null) return `dès ${formatEuro(zone.fromMinimum)}`
  return zone.availability.tone === "sold" ? "complet" : "sur demande"
}

/** "Prévue pour 6 personnes, jusqu’à 2 de plus : +150 € de minimum par personne ajoutée." */
export function supplementLabel(table: Pick<TableView, "capacity" | "surcharge">): string | null {
  const surcharge = table.surcharge
  if (!surcharge) return null
  const more = table.capacity.max - surcharge.includedGuests
  return `Prévue pour ${surcharge.includedGuests} personnes, jusqu’à ${more} de plus : +${formatEuro(surcharge.perGuest)} de minimum par personne ajoutée.`
}

/** Deposit announced for the group, or null: never presented as a payment due now. */
export function depositLabel(table: Pick<TableView, "deposit">, quote: Quote): string | null {
  if (!table.deposit || quote.deposit === null) return null
  const share =
    "percent" in table.deposit
      ? `${table.deposit.percent} % (${formatEuro(quote.deposit)})`
      : formatEuro(quote.deposit)
  return `Si le club confirme, il demande un acompte de ${share}, déduit du minimum.`
}

/** "3/4 dispo", "Sur demande" (nothing bookable directly, but not sold out) or "Complet". */
export function availabilityOf(tables: Pick<TableView, "status">[]): {
  label: string
  tone: TableStatus
} {
  const available = tables.filter((t) => t.status === "available").length
  if (available > 0) return { label: `${available}/${tables.length} dispo`, tone: "available" }
  if (tables.some((t) => t.status === "on_request"))
    return { label: "Sur demande", tone: "on_request" }
  return { label: "Complet", tone: "sold" }
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
      surcharge: t.surcharge,
      deposit: t.deposit,
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
        icon: zc?.icon ?? DEFAULT_ICON[lz.tier],
        level: lz.level,
        perks: zc?.perks ?? [],
        fromMinimum: minOf(open.map((t) => t.minimumSpend)),
        fromPerPerson: minOf(open.map((t) => t.perPerson)),
        available: zoneTables.filter((t) => t.status === "available").length,
        total: zoneTables.length,
        availability: availabilityOf(zoneTables),
        tables: zoneTables,
      }
    })
    .sort((a, b) => TIERS[a.tier].order - TIERS[b.tier].order)

  const areas = new Map((layout.standing ?? []).map((area) => [area.id, area]))
  const tickets = (content.tickets ?? []).flatMap<TicketView>((ticket) => {
    const area = areas.get(ticket.id)
    const url = ticket.url ?? content.event.ticketUrl
    if (!area || !url) return []
    return [
      {
        id: ticket.id,
        name: ticket.name,
        shortName: ticket.shortName,
        description: ticket.description,
        fromPrice: ticket.fromPrice,
        url,
        site: ticketingSite(url),
        level: area.level,
      },
    ]
  })

  return {
    zones,
    tables,
    tickets,
    ticketMarkers: tickets.map((ticket) => ({
      id: ticket.id,
      name: ticket.name,
      level: ticket.level,
      priceLabel: `dès ${formatEuro(ticket.fromPrice)}`,
    })),
    zoneMarkers: zones.map((z) => ({
      id: z.id,
      name: z.name,
      tier: z.tier,
      icon: z.icon,
      level: z.level,
      // the availability already says "Sur demande" / "Complet" when nothing is open
      fromLabel:
        z.fromMinimum !== null
          ? `dès ${formatEuro(z.fromMinimum)}`
          : z.availability.tone === "available"
            ? "prix sur demande"
            : null,
      available: z.available,
      total: z.total,
      availability: z.availability,
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
