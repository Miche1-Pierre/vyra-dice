import type { TableContent, Tier, VenueContent } from "@/lib/schema"

const TIER_RANK: Record<Tier, number> = { lounge: 0, vip: 1, prestige: 2 }

/** Sort key of a tier, from entry level (lounge = 0) to most exclusive (prestige = 2). */
export function tierRank(tier: Tier): number {
  return TIER_RANK[tier]
}

/**
 * Minimum spend shared by a full table, rounded up to the euro; `null` when the price is on
 * request.
 */
export function pricePerPerson(
  table: Pick<TableContent, "minimumSpend" | "capacity">,
): number | null {
  return table.minimumSpend === null ? null : Math.ceil(table.minimumSpend / table.capacity.max)
}

export interface ZoneSummary {
  /** Lowest minimum spend among the tables still open to requests; `null` if none is priced. */
  fromMinimum: number | null
  /** Lowest price per person among the tables still open to requests. */
  fromPerPerson: number | null
  /** Tables still open to requests: status `available` or `on_request` (not `sold`). */
  available: number
  total: number
}

const minimum = (values: (number | null)[]): number | null => {
  const numbers = values.filter((value): value is number => value !== null)
  return numbers.length > 0 ? Math.min(...numbers) : null
}

/** "From" prices and availability of a zone, as shown on its marker. */
export function zoneSummary(content: VenueContent, zoneId: string): ZoneSummary {
  const tables = content.tables.filter((table) => table.zoneId === zoneId)
  const open = tables.filter((table) => table.status !== "sold")
  return {
    fromMinimum: minimum(open.map((table) => table.minimumSpend)),
    fromPerPerson: minimum(open.map(pricePerPerson)),
    available: open.length,
    total: tables.length,
  }
}
