import type { TableKind } from "@/lib/venue/layout"

/**
 * Zone tiers, from entry level to most exclusive. Their hues belong to each club (brand.json
 * `tiers`): the interface reads them as CSS custom properties, the 3D from the brand.
 */
export const TIERS: Record<TableKind, { label: string; order: number }> = {
  lounge: { label: "Lounge", order: 0 },
  vip: { label: "VIP", order: 1 },
  prestige: { label: "Prestige", order: 2 },
}

/** CSS colour of a tier (`--lounge`…), set per club by the venue page. */
export const tierColor = (tier: TableKind) => `var(--${tier})`
/** Darker end of the tier's tile gradient. */
export const tierDeep = (tier: TableKind) => `var(--${tier}-deep)`

/** A CSS colour (custom properties included) at the given opacity. */
export function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 10000) / 100}%, transparent)`
}

export const STATUS = {
  available: { label: "Disponible", color: "#30d158" },
  on_request: { label: "Sur demande", color: "#ffd60a" },
  sold: { label: "Complet", color: "#8e8e93" },
} as const

export type TableStatus = keyof typeof STATUS
