import type { TableKind } from "@/lib/venue/layout"

/**
 * Zone tiers, colour-coded like the club sketch: green = ground floor, violet = VIP,
 * blue = prestige. Values match the `--lounge / --vip / --prestige` CSS tokens.
 * `deep` is the darker end of the icon-tile gradient.
 */
export const TIERS: Record<
  TableKind,
  { label: string; color: string; deep: string; order: number; floor: string }
> = {
  lounge: {
    label: "Lounge",
    color: "#32d074",
    deep: "#0d5a33",
    order: 0,
    floor: "Rez-de-chaussée",
  },
  vip: { label: "VIP", color: "#bf5af2", deep: "#4d1475", order: 1, floor: "Mezzanine" },
  prestige: { label: "Prestige", color: "#3a9bff", deep: "#0d3a80", order: 2, floor: "Mezzanine" },
}

export const STATUS = {
  available: { label: "Disponible", color: "#30d158" },
  on_request: { label: "Sur demande", color: "#ffd60a" },
  sold: { label: "Complet", color: "#8e8e93" },
} as const

export type TableStatus = keyof typeof STATUS
