import { z } from "zod"

// ─── Venue content: what buyers see (club-validated offers) ─────────────────────────────────────

/** Commercial tier of a zone, from entry level to most exclusive. */
export const tierSchema = z.enum(["lounge", "vip", "prestige"])
export type Tier = z.infer<typeof tierSchema>

/** Declared by the club: never a real-time stock. */
export const tableStatusSchema = z.enum(["available", "on_request", "sold"])
export type TableStatus = z.infer<typeof tableStatusSchema>

/** Lowercase URL / content id: `naho`, `lounge-vegetal`, `l1`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const slugSchema = z.string().max(64).regex(SLUG_PATTERN, { error: "Expected a lowercase slug" })
const textSchema = z.string().min(1)

export const zoneContentSchema = z.object({
  id: slugSchema,
  tier: tierSchema,
  name: textSchema,
  shortName: textSchema,
  description: textSchema,
  perks: z.array(textSchema),
})
export type ZoneContent = z.infer<typeof zoneContentSchema>

export const tableContentSchema = z.object({
  id: slugSchema,
  label: textSchema,
  zoneId: slugSchema,
  capacity: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .refine((capacity) => capacity.min <= capacity.max, {
      error: "capacity.min must not exceed capacity.max",
    }),
  /** Minimum spend for the whole table, in whole euros; `null` when the price is on request. */
  minimumSpend: z.number().int().nonnegative().nullable(),
  status: tableStatusSchema,
  /** Perks of this table on top of its zone's perks. */
  perks: z.array(textSchema),
  /** What guests see from the table, in a few words. */
  view: textSchema,
})
export type TableContent = z.infer<typeof tableContentSchema>

export const clubSchema = z
  .object({
    slug: slugSchema,
    name: textSchema,
    city: textSchema,
    address: textSchema,
    /** Three uppercase letters opening every request id (`NHO-7K2QF`). */
    requestPrefix: z.string().regex(/^[A-Z]{3}$/, { error: "Expected three uppercase letters" }),
    /** Fallback channels, shown whenever the page, the 3D or a request fails. */
    contact: z.object({
      email: z.email().optional(),
      phone: textSchema.optional(),
      whatsapp: textSchema.optional(),
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
  })
  .superRefine((content, ctx) => {
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
