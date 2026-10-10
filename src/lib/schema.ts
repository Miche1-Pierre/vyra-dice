import { z } from "zod"

// ─── Venue content: what buyers see (club-validated offers) ─────────────────────────────────────

/** Commercial tier of a zone, from entry level to most exclusive. */
export const tierSchema = z.enum(["lounge", "vip", "prestige"])
export type Tier = z.infer<typeof tierSchema>

/** Declared by the club: never a real-time stock. */
export const tableStatusSchema = z.enum(["available", "on_request", "sold"])
export type TableStatus = z.infer<typeof tableStatusSchema>

/** Lowercase URL / content id: `club-demo`, `lounge-bar`, `l1`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const slugSchema = z.string().max(64).regex(SLUG_PATTERN, { error: "Expected a lowercase slug" })
const textSchema = z.string().min(1)

/** Glyph drawn on the zone's icon in the dock, the search and the price tags. */
export const zoneIconSchema = z.enum(["leaf", "martini", "disc", "sunrise", "sofa", "crown", "gem"])
export type ZoneIcon = z.infer<typeof zoneIconSchema>

export const zoneContentSchema = z.object({
  id: slugSchema,
  tier: tierSchema,
  name: textSchema,
  shortName: textSchema,
  description: textSchema,
  perks: z.array(textSchema),
  icon: zoneIconSchema.optional(),
})
export type ZoneContent = z.infer<typeof zoneContentSchema>

/**
 * Guests above `includedGuests` raise the minimum spend by `perGuest` euros each, up to
 * `capacity.max` (e.g. a table for 6, up to 2 more at +150 € each).
 */
export const surchargeSchema = z.object({
  includedGuests: z.number().int().positive(),
  perGuest: z.number().int().positive(),
})
export type Surcharge = z.infer<typeof surchargeSchema>

/**
 * Deposit the club asks for once it confirms the table, deducted from the minimum spend: a share
 * of the minimum for the group, or a fixed amount in whole euros. Nothing is paid with a request.
 */
export const depositSchema = z.union([
  z.object({ percent: z.number().int().min(1).max(100) }),
  z.object({ amount: z.number().int().positive() }),
])
export type Deposit = z.infer<typeof depositSchema>

export const tableContentSchema = z
  .object({
    id: slugSchema,
    label: textSchema,
    zoneId: slugSchema,
    capacity: z
      .object({ min: z.number().int().positive(), max: z.number().int().positive() })
      .refine((capacity) => capacity.min <= capacity.max, {
        error: "capacity.min must not exceed capacity.max",
      }),
    /** Minimum spend for the whole table, in whole euros; `null` when the price is on request. */
    minimumSpend: z.number().int().positive().nullable(),
    /** Optional supplement per guest above the included ones. */
    surcharge: surchargeSchema.optional(),
    /** Optional deposit asked at confirmation. */
    deposit: depositSchema.optional(),
    status: tableStatusSchema,
    /** Perks of this table on top of its zone's perks. */
    perks: z.array(textSchema),
    /** What guests see from the table, in a few words. */
    view: textSchema,
  })
  .superRefine((table, ctx) => {
    const { surcharge, deposit, minimumSpend, capacity } = table
    if (surcharge && minimumSpend === null) {
      ctx.addIssue({
        code: "custom",
        message: "A supplement per guest needs a minimum spend",
        path: ["surcharge"],
      })
    }
    if (
      surcharge &&
      (surcharge.includedGuests < capacity.min || surcharge.includedGuests >= capacity.max)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "surcharge.includedGuests must be at least capacity.min and below capacity.max",
        path: ["surcharge", "includedGuests"],
      })
    }
    if (deposit && "percent" in deposit && minimumSpend === null) {
      ctx.addIssue({
        code: "custom",
        message: "A deposit in percent needs a minimum spend",
        path: ["deposit"],
      })
    }
    if (deposit && "amount" in deposit && minimumSpend !== null && deposit.amount > minimumSpend) {
      ctx.addIssue({
        code: "custom",
        message: "The deposit cannot exceed the minimum spend",
        path: ["deposit", "amount"],
      })
    }
  })
export type TableContent = z.infer<typeof tableContentSchema>

/**
 * Entry ticket for a standing area of the plan (same id), sold on the club's ticketing site: the
 * visit shows where it is and links out, it never sells it.
 */
export const ticketOfferSchema = z.object({
  id: slugSchema,
  name: textSchema,
  shortName: textSchema,
  /** One short line: what this ticket gives (standing, near the stage…). */
  description: textSchema,
  /** Lowest price of the ticket per person, in whole euros, as on the ticketing site. */
  fromPrice: z.number().int().positive(),
  /** Ticketing page of this ticket; the event's `ticketUrl` otherwise. */
  url: z.url({ protocol: /^https?$/ }).optional(),
})
export type TicketOffer = z.infer<typeof ticketOfferSchema>

export const clubSchema = z
  .object({
    slug: slugSchema,
    name: textSchema,
    city: textSchema,
    address: textSchema,
    /** Three uppercase letters opening every request id (`DEM-7K2QF`). */
    requestPrefix: z.string().regex(/^[A-Z]{3}$/, { error: "Expected three uppercase letters" }),
    /** Fallback channels, shown whenever the page, the 3D or a request fails. */
    contact: z.object({
      email: z.email().optional(),
      phone: textSchema.optional(),
      /** WhatsApp number in international format (`+33 6 12 34 56 78`), opened with wa.me. */
      whatsapp: z
        .string()
        .trim()
        .regex(/^\+[1-9][\d\s().-]+$/, {
          error: "Expected an international number, e.g. +33 6 12 34 56 78",
        })
        .refine((phone) => /^\d{8,15}$/.test(phone.replace(/\D/g, "")), {
          error: "Expected 8 to 15 digits",
        })
        .optional(),
      /** Instagram handle, without the leading @. */
      instagram: z
        .string()
        .regex(/^[A-Za-z0-9._]{1,30}$/, { error: "Expected an Instagram handle without @" })
        .optional(),
    }),
    /** Demo venues show provisional data and never transmit requests. */
    demo: z.boolean(),
    disclaimer: z.string(),
  })
  .refine((club) => !club.demo || club.disclaimer.trim().length > 0, {
    error: "A demo club must show a disclaimer",
    path: ["disclaimer"],
  })
export type Club = z.infer<typeof clubSchema>

export const eventSchema = z.object({
  slug: slugSchema,
  name: textSchema,
  /**
   * Billing under the night's name (« DJ guest »): the night is then billed like its poster, its
   * name in large letters on the loading screen, the overview and the home page.
   */
  subtitle: z.string().min(1).max(40).optional(),
  /** Calendar date of the night (yyyy-mm-dd), even when it ends after midnight. */
  date: z.iso.date(),
  /** Opening time, "HH:MM". */
  doors: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Expected HH:MM" }),
  /** Ticketing page (Shotgun…): entry tickets are not sold here. */
  ticketUrl: z.url({ protocol: /^https?$/ }).optional(),
  /** When the club validated prices and statuses; `null` = not validated (demo data). */
  offersValidatedAt: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).nullable(),
})
export type ClubEvent = z.infer<typeof eventSchema>

/** Indexes of the items whose id already appeared earlier in the list. */
function duplicateIndexes(items: readonly { id: string }[]): number[] {
  const seen = new Set<string>()
  const duplicates: number[] = []
  items.forEach((item, index) => {
    if (seen.has(item.id)) duplicates.push(index)
    seen.add(item.id)
  })
  return duplicates
}

export const venueContentSchema = z
  .object({
    club: clubSchema,
    event: eventSchema,
    zones: z.array(zoneContentSchema).min(1),
    tables: z.array(tableContentSchema).min(1),
    /** Booking conditions shown with every table. */
    conditions: z.array(textSchema),
    /** Standing areas sold on the ticketing site (optional). */
    tickets: z.array(ticketOfferSchema).optional(),
  })
  .superRefine((content, ctx) => {
    const tickets = content.tickets ?? []
    for (const index of duplicateIndexes(tickets)) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate ticket id",
        path: ["tickets", index, "id"],
      })
    }
    tickets.forEach((ticket, index) => {
      if (!ticket.url && !content.event.ticketUrl) {
        ctx.addIssue({
          code: "custom",
          message: "A ticket needs a url, or the event a ticketUrl",
          path: ["tickets", index, "url"],
        })
      }
    })
    for (const index of duplicateIndexes(content.zones)) {
      ctx.addIssue({ code: "custom", message: "Duplicate zone id", path: ["zones", index, "id"] })
    }
    for (const index of duplicateIndexes(content.tables)) {
      ctx.addIssue({ code: "custom", message: "Duplicate table id", path: ["tables", index, "id"] })
    }
    const zoneIds = new Set(content.zones.map((zone) => zone.id))
    content.tables.forEach((table, index) => {
      if (!zoneIds.has(table.zoneId)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown zone "${table.zoneId}"`,
          path: ["tables", index, "zoneId"],
        })
      }
    })
    if (!content.club.demo && content.event.offersValidatedAt === null) {
      ctx.addIssue({
        code: "custom",
        message: "A live club only shows offers it has validated (set offersValidatedAt)",
        path: ["event", "offersValidatedAt"],
      })
    }
  })
export type VenueContent = z.infer<typeof venueContentSchema>
export type VenueContentInput = z.input<typeof venueContentSchema>

// ─── Booking request: same schema for the client form and the Server Action ─────────────────────

export const arrivalTimes = ["23:30", "00:00", "00:30", "01:00", "01:30"] as const
export type ArrivalTime = (typeof arrivalTimes)[number]

/**
 * 8 to 20 characters: an optional leading "+", then digits, spaces and `( ) . -`, with at least
 * 8 digits. Accepts "06 12 34 56 78", "+33 6 12 34 56 78", "+33 (0)6 12-34-56-78".
 */
const PHONE_PATTERN = /^(?=.{8,20}$)(?=(?:\D*\d){8})\+?[\d\s().-]+$/

/** One campaign parameter. Invalid values are dropped: tracking never blocks a request. */
const attributionValue = z.string().trim().min(1).max(200).optional().catch(undefined)

/** Campaign parameters of the landing URL (`utm_*`, `ref`). */
export const attributionSchema = z.object({
  utm_source: attributionValue,
  utm_medium: attributionValue,
  utm_campaign: attributionValue,
  utm_content: attributionValue,
  ref: attributionValue,
})
export type Attribution = z.infer<typeof attributionSchema>

const referenceSchema = (message: string) =>
  z.string({ error: message }).max(64, { error: message }).regex(SLUG_PATTERN, { error: message })

export const bookingRequestInputSchema = z.object(
  {
    clubSlug: referenceSchema("Club inconnu"),
    eventSlug: referenceSchema("Soirée inconnue"),
    tableId: referenceSchema("Table inconnue"),
    fullName: z
      .string({ error: "Indiquez votre nom" })
      .trim()
      .min(2, { error: "Indiquez votre nom (2 caractères minimum)" })
      .max(80, { error: "Nom trop long (80 caractères maximum)" }),
    phone: z
      .string({ error: "Indiquez votre numéro de téléphone" })
      .trim()
      .min(1, { error: "Indiquez votre numéro de téléphone", abort: true })
      .regex(PHONE_PATTERN, { error: "Numéro invalide (ex. 06 12 34 56 78)" })
      .transform((phone) => phone.replace(/\s+/g, " ")),
    email: z
      .string({ error: "Adresse e-mail invalide" })
      .trim()
      .max(254, { error: "Adresse e-mail trop longue" })
      .pipe(
        z.union([z.literal(""), z.email({ error: "Adresse e-mail invalide" })], {
          error: "Adresse e-mail invalide",
        }),
      )
      .transform((email) => email || undefined)
      .optional(),
    partySize: z.coerce
      .number({ error: "Indiquez le nombre de personnes" })
      .int({ error: "Indiquez un nombre entier de personnes" })
      .min(1, { error: "Au moins 1 personne" })
      .max(30, { error: "30 personnes maximum par demande" }),
    arrivalTime: z.enum(arrivalTimes, { error: "Choisissez une heure d'arrivée" }),
    message: z
      .string({ error: "Message invalide" })
      .trim()
      .max(500, { error: "Message trop long (500 caractères maximum)" })
      .transform((message) => message || undefined)
      .optional(),
    consent: z.literal(true, { error: "Merci d'accepter d'être recontacté par le club" }),
    idempotencyKey: z.uuid({ error: "Formulaire expiré, rechargez la page" }),
    attribution: attributionSchema.optional().catch(undefined),
  },
  { error: "Demande invalide" },
)
/** Validated request, as received by the Server Action. */
export type BookingRequestInput = z.output<typeof bookingRequestInputSchema>
/** Raw values of the request form (before validation). */
export type BookingRequestFormValues = z.input<typeof bookingRequestInputSchema>

export type SubmitError = "validation" | "rate_limited" | "unknown_table" | "unavailable" | "server"

export type SubmitResult =
  | { ok: true; requestId: string; demo: boolean; duplicate: boolean }
  | { ok: false; error: SubmitError; fieldErrors?: Record<string, string> }

/** First message per field, keyed by dotted path (`partySize`); issues on the root go to `form`. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "form"
    fieldErrors[key] ??= issue.message
  }
  return fieldErrors
}
