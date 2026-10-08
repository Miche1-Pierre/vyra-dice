import { venueContentSchema, type VenueContent, type VenueContentInput } from "@/lib/schema"

/**
 * A fictional venue night for unit tests, independent of the registered clubs: two zones and
 * one table per status (`l2` is sold, `v1` is on request, `v2` has no price).
 */
export function demoVenueInput(): VenueContentInput {
  return {
    club: {
      slug: "demo",
      name: "Club Démo",
      city: "Toulon",
      address: "1 rue du Port, 83000 Toulon",
      requestPrefix: "DEM",
      contact: { instagram: "club.demo" },
      demo: true,
      disclaimer: "Démo — données fictives.",
    },
    event: {
      slug: "samedi",
      name: "Samedi",
      date: "2026-10-10",
      doors: "23:30",
      offersValidatedAt: null,
    },
    zones: [
      {
        id: "lounge",
        tier: "lounge",
        name: "Lounge",
        shortName: "Lounge",
        description: "Bord de piste",
        perks: ["Service à table"],
      },
      {
        id: "vip",
        tier: "vip",
        name: "VIP",
        shortName: "VIP",
        description: "Mezzanine",
        perks: ["Accès coupe-file"],
      },
    ],
    tables: [
      {
        id: "l1",
        label: "L1",
        zoneId: "lounge",
        capacity: { min: 4, max: 6 },
        minimumSpend: 350,
        status: "available",
        perks: [],
        view: "Bord de piste",
      },
      {
        id: "l2",
        label: "L2",
        zoneId: "lounge",
        capacity: { min: 4, max: 6 },
        minimumSpend: 300,
        status: "sold",
        perks: [],
        view: "Face au bar",
      },
      {
        id: "v1",
        label: "V1",
        zoneId: "vip",
        capacity: { min: 6, max: 8 },
        minimumSpend: 700,
        status: "on_request",
        perks: [],
        view: "Vue sur la scène",
      },
      {
        id: "v2",
        label: "V2",
        zoneId: "vip",
        capacity: { min: 6, max: 8 },
        minimumSpend: null,
        status: "available",
        perks: [],
        view: "Balcon",
      },
    ],
    conditions: ["Minimum de consommation pour la table entière."],
  }
}

export const demoVenue: VenueContent = venueContentSchema.parse(demoVenueInput())
