import { venueContentSchema, type VenueContent, type VenueContentInput } from "@/lib/schema"
import type { RequestDetails } from "@/server/notify/messages"

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

/** A request for table L1 of the fictional venue, as the messages about it see it. */
export function requestDetails(overrides: Partial<RequestDetails> = {}): RequestDetails {
  return {
    requestId: "DEM-7K2QF",
    idempotencyKey: "0b8c2c6e-3f1a-4d7e-9f2a-6f1c2d3e4a5b",
    createdAt: "2026-10-10T21:42:00.000Z",
    demo: true,
    club: { slug: "demo", name: "Club Démo", contact: { instagram: "club.demo" } },
    accent: { color: "#dc1414", on: "#fff4ee" },
    event: { name: "Samedi", date: "2026-10-10" },
    table: { label: "L1", zoneName: "Lounge" },
    partySize: 5,
    arrivalTime: "00:30",
    buyer: {
      firstName: "Camille",
      lastName: "Martin",
      phone: "06 12 34 56 78",
      email: "camille@example.com",
      message: "Anniversaire\nDeux bouteilles",
    },
    quote: { minimumSpend: 350, deposit: 70 },
    attribution: { utm_source: "instagram", ref: "story" },
    ...overrides,
  }
}
