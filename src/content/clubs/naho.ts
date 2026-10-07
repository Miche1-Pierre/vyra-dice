import {
  venueContentSchema,
  type TableStatus,
  type VenueContent,
  type VenueContentInput,
} from "@/lib/schema"

/*
 * Naho Club (La Garde): DEMO content for the sales pitch.
 * Tables, prices and statuses are provisional and NOT validated by the club: never present them as
 * real offers. Zone and table ids must match `art/layouts/naho.json`.
 */

const loungePerks = ["Service à table", "Softs et glaçons inclus"]
const vipPerks = ["Service à table dédié", "Softs et glaçons inclus", "Accès coupe-file"]
const prestigePerks = [
  "Hôte dédié",
  "Accès coupe-file",
  "Softs, glaçons et finger food inclus",
  "Show bouteille",
]

type TableRow = [id: string, minimumSpend: number | null, status: TableStatus, view: string]

/** Tables of one zone sharing a capacity; each row is [id, minimum spend in €, status, view]. */
function zoneTables(
  zoneId: string,
  [min, max]: [number, number],
  rows: TableRow[],
): VenueContentInput["tables"] {
  return rows.map(([id, minimumSpend, status, view]) => ({
    id,
    label: id.toUpperCase(),
    zoneId,
    capacity: { min, max },
    minimumSpend,
    status,
    perks: [],
    view,
  }))
}

const content: VenueContentInput = {
  club: {
    slug: "naho",
    name: "Naho Club",
    city: "La Garde",
    address: "116 avenue de Digne, 83130 La Garde",
    requestPrefix: "NHO",
    contact: { email: "contact@naho-club.com", instagram: "naho_club" },
    demo: true,
    disclaimer: "Démo — plan, tables et prix provisoires, non validés par Naho Club.",
  },
  event: {
    slug: "samedi",
    name: "Samedi soir",
    date: "2026-10-10",
    doors: "23:30",
    ticketUrl: "https://shotgun.live/fr/venues/naho-club",
    offersValidatedAt: null,
  },
  zones: [
    {
      id: "lounge-vegetal",
      tier: "lounge",
      name: "Lounge Végétal",
      shortName: "Végétal",
      description: "Banquettes le long du mur végétal, en bord de piste.",
      perks: loungePerks,
    },
    {
      id: "lounge-mezzanine",
      tier: "lounge",
      name: "Lounge Gold",
      shortName: "Gold",
      description: "Alcôves feutrées sous la mezzanine, ambiance dorée.",
      perks: loungePerks,
    },
    {
      id: "vip-balcon",
      tier: "vip",
      name: "Balcon DJ",
      shortName: "Balcon",
      description: "Au-dessus de la cabine DJ, vue plongeante sur la piste.",
      perks: vipPerks,
    },
    {
      id: "vip-est",
      tier: "vip",
      name: "Mezzanine Est",
      shortName: "Est",
      description: "Le long du garde-corps, face au bar et à la pluie de LED.",
      perks: vipPerks,
    },
    {
      id: "vip-sud",
      tier: "vip",
      name: "Mezzanine Sud",
      shortName: "Sud",
      description: "Face à la salle, à deux pas du bar VIP.",
      perks: vipPerks,
    },
    {
      id: "prestige-dj",
      tier: "prestige",
      name: "Carré DJ",
      shortName: "Carré DJ",
      description: "Le carré le plus exclusif, à hauteur de la scène, avec hôte dédié.",
      perks: prestigePerks,
    },
    {
      id: "prestige-loge",
      tier: "prestige",
      name: "Loge Welcome",
      shortName: "Loge",
      description: "Loge privative au-dessus de l'entrée, vue sur toute la salle.",
      perks: prestigePerks,
    },
  ],
  tables: [
    ...zoneTables(
      "lounge-vegetal",
      [4, 6],
      [
        ["l1", 350, "available", "Côté entrée, face au bar"],
        ["l2", 350, "sold", "Bord de piste, vue sur le bar"],
        ["l3", 400, "available", "Au centre du mur végétal, face à la piste"],
        ["l4", 400, "available", "Bord de piste, entre bar et scène"],
        ["l5", 450, "available", "Au pied de l'escalier, près du DJ"],
      ],
    ),
    ...zoneTables(
      "lounge-mezzanine",
      [4, 6],
      [
        ["l6", 350, "available", "Alcôve côté scène, sous la mezzanine"],
        ["l7", 350, "sold", "Alcôve feutrée, vue sur la scène"],
        ["l8", 400, "available", "Alcôve centrale, face au bar"],
        ["l9", 400, "available", "Alcôve feutrée, face au bar"],
        ["l10", 350, "available", "Alcôve en retrait, au calme"],
      ],
    ),
    ...zoneTables(
      "vip-balcon",
      [6, 8],
      [
        ["v1", 900, "available", "Côté escalier, vue plongeante sur la piste"],
        ["v2", 1000, "on_request", "Pile au-dessus du DJ, vue sur toute la salle"],
        ["v3", 900, "available", "Au-dessus de la scène, vue sur la piste et le bar"],
      ],
    ),
    ...zoneTables(
      "vip-est",
      [6, 8],
      [
        ["v4", 750, "available", "Garde-corps côté scène, vue sur la piste"],
        ["v5", 750, "sold", "Face au bar et à la pluie de LED"],
        ["v6", 700, "available", "Face au bar, vue sur toute la salle"],
        ["v7", 700, "available", "Angle sud, vue sur la salle et la loge"],
      ],
    ),
    ...zoneTables(
      "vip-sud",
      [6, 8],
      [
        ["v8", 650, "available", "Dans l'axe de la scène, à deux pas du bar VIP"],
        ["v9", 700, "available", "Au-dessus de l'escalier, face à la salle"],
        ["v10", 650, "available", "Angle est, vue sur la salle et la mezzanine"],
      ],
    ),
    ...zoneTables(
      "prestige-dj",
      [10, 15],
      [["p1", 2500, "on_request", "À hauteur de la scène, face au DJ"]],
    ),
    ...zoneTables(
      "prestige-loge",
      [10, 12],
      [["p2", 2000, "available", "Au-dessus de l'entrée, vue sur toute la salle"]],
    ),
  ],
  conditions: [
    "Le minimum de consommation s'entend par table, sur la carte bouteilles.",
    "La table n'est réservée qu'après confirmation par le club.",
    "Arrivée avant 01h00 ; au-delà, la table peut être réattribuée.",
    "Tenue correcte exigée, 18 ans minimum.",
  ],
}

export const nahoContent: VenueContent = venueContentSchema.parse(content)
