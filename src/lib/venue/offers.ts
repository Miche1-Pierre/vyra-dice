import type { TableContent, Tier, VenueContent } from "@/lib/schema"

const TIER_RANK: Record<Tier, number> = { lounge: 0, vip: 1, prestige: 2 }

/** Sort key of a tier, from entry level (lounge = 0) to most exclusive (prestige = 2). */
export function tierRank(tier: Tier): number {
  return TIER_RANK[tier]
}

type PricedTable = Pick<TableContent, "minimumSpend" | "capacity" | "surcharge" | "deposit">

/**
 * Minimum spend for a group of `guests`: the table's minimum, plus the supplement for each guest
 * above the included ones; `null` when the price is on request.
 */
export function minimumFor(table: Omit<PricedTable, "deposit">, guests: number): number | null {
  if (table.minimumSpend === null) return null
  const extra = table.surcharge ? Math.max(0, guests - table.surcharge.includedGuests) : 0
  return table.minimumSpend + extra * (table.surcharge?.perGuest ?? 0)
}

/** What a group of `guests` is told before sending a request: never a payment, only figures. */
export interface Quote {
  guests: number
  /** Guests above the included ones, each raising the minimum by the supplement. */
  extraGuests: number
  /** Minimum spend for the group; `null` when the price is on request. */
  minimumSpend: number | null
  /** That minimum shared by the group, rounded up to the euro; `null` when on request. */
  perPerson: number | null
  /** Deposit asked once the club confirms, deducted from the minimum; `null` without one. */
  deposit: number | null
}

/** Amounts for a group of `guests` (expected within the table's capacity). */
export function quoteFor(table: PricedTable, guests: number): Quote {
  const minimumSpend = minimumFor(table, guests)
  const { deposit } = table
  let depositAmount: number | null = null
  if (deposit && "amount" in deposit) depositAmount = deposit.amount
  else if (deposit && minimumSpend !== null) {
    depositAmount = Math.round((minimumSpend * deposit.percent) / 100)
  }
  return {
    guests,
    extraGuests: table.surcharge ? Math.max(0, guests - table.surcharge.includedGuests) : 0,
    minimumSpend,
    perPerson: minimumSpend === null ? null : Math.ceil(minimumSpend / Math.max(1, guests)),
    deposit: depositAmount,
  }
}

/**
 * Minimum spend shared by a full table, rounded up to the euro; `null` when the price is on
 * request.
 */
export function pricePerPerson(table: Omit<PricedTable, "deposit">): number | null {
  const minimum = minimumFor(table, table.capacity.max)
  return minimum === null ? null : Math.ceil(minimum / table.capacity.max)
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
