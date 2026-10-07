import type { TableKind } from "@/lib/venue/layout"

/** Zone tiers, colour-coded like the club sketch: green = ground, violet = VIP, blue = prestige. */
export const TIERS: Record<
  TableKind,
  { label: string; color: string; order: number; floor: string }
> = {
  lounge: { label: "Lounge", color: "#34d27b", order: 0, floor: "Rez-de-chaussée" },
  vip: { label: "VIP", color: "#a855f7", order: 1, floor: "Mezzanine" },
  prestige: { label: "Prestige", color: "#4f7cff", order: 2, floor: "Mezzanine" },
}

export const STATUS = {
  available: { label: "Disponible", color: "#34d399" },
  on_request: { label: "Sur demande", color: "#fbbf24" },
  sold: { label: "Complet", color: "#f43f5e" },
} as const

export type TableStatus = keyof typeof STATUS
