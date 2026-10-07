import { describe, expect, it } from "vitest"

import {
  bookingRequestInputSchema,
  toFieldErrors,
  venueContentSchema,
  type VenueContentInput,
} from "@/lib/schema"

function requestInput(overrides: Record<string, unknown> = {}) {
  return {
    clubSlug: "naho",
    eventSlug: "samedi",
    tableId: "v1",
    fullName: "  Camille Martin ",
    phone: "06 12 34 56 78",
    email: "",
    partySize: "6",
    arrivalTime: "00:00",
    message: "",
    consent: true,
    idempotencyKey: crypto.randomUUID(),
    attribution: { utm_source: "instagram", ref: "story" },
    ...overrides,
  }
}

/** Distinct dotted paths of the issues raised by an invalid input. */
function failingPaths(input: unknown): string[] {
  const result = bookingRequestInputSchema.safeParse(input)
  if (result.success) throw new Error("expected the input to be rejected")
  return [...new Set(result.error.issues.map((issue) => issue.path.join(".")))]
}

describe("bookingRequestInputSchema", () => {
  it("accepts a valid request and normalises it", () => {
    const result = bookingRequestInputSchema.safeParse(requestInput())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toMatchObject({
      fullName: "Camille Martin",
      phone: "06 12 34 56 78",
      partySize: 6,
      arrivalTime: "00:00",
      consent: true,
      attribution: { utm_source: "instagram", ref: "story" },
    })
    expect(result.data.email).toBeUndefined()
    expect(result.data.message).toBeUndefined()
  })

  it("accepts French and international phone formats", () => {
    for (const phone of [
      "0612345678",
      "+33 6 12 34 56 78",
      "+33 (0)6 12-34-56-78",
      "06.12.34.56.78",
    ]) {
      expect(bookingRequestInputSchema.safeParse(requestInput({ phone })).success, phone).toBe(true)
    }
  })

  it("collapses pasted non-breaking spaces in phone numbers", () => {
    const nbsp = String.fromCharCode(0x00a0)
    const narrowNbsp = String.fromCharCode(0x202f)
    const phone = `06${nbsp}12${narrowNbsp}34  56 78`
    const parsed = bookingRequestInputSchema.parse(requestInput({ phone }))
    expect(parsed.phone).toBe("06 12 34 56 78")
  })

  it("accepts omitted optional fields", () => {
    const input: Record<string, unknown> = requestInput()
    delete input.email
    delete input.message
    delete input.attribution
    const parsed = bookingRequestInputSchema.parse(input)
    expect(parsed).not.toHaveProperty("email")
    expect(parsed).not.toHaveProperty("message")
    expect(parsed.attribution).toBeUndefined()
  })

  it("keeps a valid optional email", () => {
    const parsed = bookingRequestInputSchema.parse(requestInput({ email: " camille@example.com " }))
    expect(parsed.email).toBe("camille@example.com")
  })

  it("re-validates its own output (the form sends parsed values to the action)", () => {
    const parsed = bookingRequestInputSchema.parse(requestInput({ email: "a@b.fr", message: "Hi" }))
    expect(bookingRequestInputSchema.parse(parsed)).toEqual(parsed)
  })

  it("rejects invalid phone numbers", () => {
    for (const phone of [
      "",
      "12 34",
      "abcdefghij",
      "++33612345678",
      "06 12 34 56 78 90 12 34 56",
    ]) {
      expect(failingPaths(requestInput({ phone })), phone).toEqual(["phone"])
    }
  })

  it("rejects an invalid email", () => {
    expect(failingPaths(requestInput({ email: "pas-un-email" }))).toEqual(["email"])
  })

  it("requires consent", () => {
    expect(failingPaths(requestInput({ consent: false }))).toEqual(["consent"])
    expect(failingPaths(requestInput({ consent: undefined }))).toEqual(["consent"])
    const result = bookingRequestInputSchema.safeParse(requestInput({ consent: false }))
    expect(result.error?.issues[0].message).toBe("Merci d'accepter d'être recontacté par le club")
  })

  it("rejects a party size outside 1–30", () => {
    for (const partySize of [0, 31, 2.5, "abc", undefined]) {
      expect(failingPaths(requestInput({ partySize })), String(partySize)).toEqual(["partySize"])
    }
  })

  it("rejects an arrival time outside the proposed slots", () => {
    expect(failingPaths(requestInput({ arrivalTime: "22:00" }))).toEqual(["arrivalTime"])
  })

  it("rejects names that are too short or too long", () => {
    expect(failingPaths(requestInput({ fullName: " A " }))).toEqual(["fullName"])
    expect(failingPaths(requestInput({ fullName: "A".repeat(81) }))).toEqual(["fullName"])
  })

  it("rejects malformed references and idempotency keys", () => {
    expect(failingPaths(requestInput({ tableId: "V1; drop" }))).toEqual(["tableId"])
    expect(failingPaths(requestInput({ idempotencyKey: "123" }))).toEqual(["idempotencyKey"])
  })

  it("drops invalid attribution instead of rejecting the request", () => {
    const parsed = bookingRequestInputSchema.parse(
      requestInput({ attribution: { utm_source: 42, utm_medium: "x".repeat(201), ref: " qr " } }),
    )
    expect(parsed.attribution).toEqual({ ref: "qr" })
    expect(bookingRequestInputSchema.parse(requestInput({ attribution: "?" })).attribution).toBe(
      undefined,
    )
  })
})

describe("toFieldErrors", () => {
  it("maps the first issue of each field to its French message", () => {
    const result = bookingRequestInputSchema.safeParse(
      requestInput({ phone: "", email: "nope", partySize: 0, consent: false }),
    )
    if (result.success) throw new Error("expected failure")
    const fieldErrors = toFieldErrors(result.error)
    expect(Object.keys(fieldErrors).sort()).toEqual(["consent", "email", "partySize", "phone"])
    expect(fieldErrors.phone).toBe("Indiquez votre numéro de téléphone")
    expect(fieldErrors.email).toBe("Adresse e-mail invalide")
    expect(fieldErrors.partySize).toBe("Au moins 1 personne")
  })

  it("reports a non-object payload under `form`", () => {
    const result = bookingRequestInputSchema.safeParse(null)
    if (result.success) throw new Error("expected failure")
    expect(toFieldErrors(result.error)).toEqual({ form: "Demande invalide" })
  })
})

function venueContent(): VenueContentInput {
  return {
    club: {
      slug: "demo",
      name: "Club Démo",
      city: "Toulon",
      address: "1 rue du Port, 83000 Toulon",
      requestPrefix: "DEM",
      contact: { instagram: "club.demo" },
      demo: true,
      disclaimer: "Démo",
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
        perks: [],
      },
    ],
    tables: [
      {
        id: "l1",
        label: "L1",
        zoneId: "lounge",
        capacity: { min: 4, max: 6 },
        minimumSpend: 300,
        status: "available",
        perks: [],
        view: "Bord de piste",
      },
    ],
    conditions: [],
  }
}

function contentIssuePaths(content: VenueContentInput): string[] {
  const result = venueContentSchema.safeParse(content)
  if (result.success) throw new Error("expected the content to be rejected")
  return result.error.issues.map((issue) => issue.path.join("."))
}

describe("venueContentSchema", () => {
  it("accepts consistent content", () => {
    expect(venueContentSchema.safeParse(venueContent()).success).toBe(true)
  })

  it("rejects tables pointing to an unknown zone", () => {
    const content = venueContent()
    content.tables[0].zoneId = "ailleurs"
    expect(contentIssuePaths(content)).toEqual(["tables.0.zoneId"])
  })

  it("rejects duplicate ids", () => {
    const content = venueContent()
    content.tables.push({ ...content.tables[0] })
    expect(contentIssuePaths(content)).toEqual(["tables.1.id"])
  })

  it("rejects capacities where min exceeds max", () => {
    const content = venueContent()
    content.tables[0].capacity = { min: 8, max: 6 }
    expect(contentIssuePaths(content)).toEqual(["tables.0.capacity"])
  })

  it("requires a disclaimer on demo clubs", () => {
    const content = venueContent()
    content.club.disclaimer = " "
    expect(contentIssuePaths(content)).toEqual(["club.disclaimer"])
  })

  it("refuses unvalidated offers for a live club", () => {
    const content = venueContent()
    content.club.demo = false
    expect(contentIssuePaths(content)).toEqual(["event.offersValidatedAt"])
    content.event.offersValidatedAt = "2026-10-01"
    expect(venueContentSchema.safeParse(content).success).toBe(true)
  })

  it("validates club and event formats", () => {
    const content = venueContent()
    content.club.requestPrefix = "dm"
    content.club.contact = { instagram: "@club" }
    content.event.date = "10/10/2026"
    content.event.doors = "25:00"
    content.event.ticketUrl = "javascript:alert(1)"
    expect(contentIssuePaths(content).sort()).toEqual([
      "club.contact.instagram",
      "club.requestPrefix",
      "event.date",
      "event.doors",
      "event.ticketUrl",
    ])
  })
})
