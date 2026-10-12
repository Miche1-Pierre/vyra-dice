"use server"

import { headers } from "next/headers"
import { after } from "next/server"

import { getClub, getVenueContent } from "@/lib/clubs/registry"
import { createRequestId } from "@/lib/request-id"
import {
  bookingRequestInputSchema,
  toFieldErrors,
  type SubmitResult,
  type TableContent,
  type VenueContent,
} from "@/lib/schema"
import { quoteFor } from "@/lib/venue/offers"
import { readNotifyConfig } from "@/server/notify/config"
import type { RequestDetails } from "@/server/notify/messages"
import { acknowledgeBuyer, canNotify, notifyManager } from "@/server/notify/notify"
import { demoSink } from "@/server/requests/demo-sink"
import { createRateLimiter } from "@/server/requests/rate-limit"
import type { BookingRequestRecord } from "@/server/requests/sink"

/** 5 requests per 10 minutes per client IP and club, per server instance. */
const rateLimiter = createRateLimiter()
/** One summary per buyer address every 10 minutes: the form must not flood anyone's inbox. */
const summaryLimiter = createRateLimiter({ limit: 1, windowMs: 10 * 60 * 1000 })

/**
 * Receives a table request from the venue page. A request is never a confirmed booking. A demo
 * club's requests go to the team, by e-mail and WhatsApp when they are set up, never to the club.
 */
export async function submitBookingRequest(input: unknown): Promise<SubmitResult> {
  try {
    const parsed = bookingRequestInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: "validation", fieldErrors: toFieldErrors(parsed.error) }
    }
    const { leaveBlank, ...request } = parsed.data
    // a field people never see: only a robot fills it in, and nothing is sent for it
    if (leaveBlank) {
      console.error("[submitBookingRequest] dropped: the hidden field was filled in")
      return { ok: false, error: "server" }
    }

    const content = getVenueContent(request.clubSlug, request.eventSlug)
    const table = content?.tables.find((candidate) => candidate.id === request.tableId)
    if (!content || !table) return { ok: false, error: "unknown_table" }
    if (table.status === "sold") return { ok: false, error: "unavailable" }
    // the bounds the club set for the table, as shown in the form
    const { min, max } = table.capacity
    if (request.partySize < min || request.partySize > max) {
      const partySize =
        min === max
          ? `Cette table accueille ${max} personnes`
          : `Cette table accueille de ${min} à ${max} personnes`
      return { ok: false, error: "validation", fieldErrors: { partySize } }
    }
    if (!content.club.demo) {
      // A live club needs a sink that actually reaches it. Until one exists, fail so the buyer gets
      // the fallback contact instead of an acknowledgement nobody will read.
      console.error("[submitBookingRequest] no request sink for live club", content.club.slug)
      return { ok: false, error: "server" }
    }

    const { allowed } = rateLimiter.check(`${content.club.slug}:${await clientIp()}`)
    if (!allowed) return { ok: false, error: "rate_limited" }

    const quote = quoteFor(table, request.partySize)
    const config = readNotifyConfig()
    // a demo club's requests go to the team: never to the club before its written agreement
    const recipients = config.team
    const transmits = canNotify(config, recipients)
    const record: BookingRequestRecord = {
      ...request,
      requestId: createRequestId(content.club.requestPrefix),
      createdAt: new Date().toISOString(),
      status: "received",
      transmission: transmits ? "pending" : "not_sent_demo",
      quote: { minimumSpend: quote.minimumSpend, deposit: quote.deposit },
    }
    const { requestId, duplicate } = await demoSink.save(record)
    const accepted = {
      ok: true as const,
      requestId,
      demo: content.club.demo,
      duplicate,
      transmitted: transmits,
      acknowledged: false,
    }
    // a duplicate was sent, and acknowledged, with the first request
    if (duplicate || !transmits) return accepted

    const details = requestDetails(content, table, { ...record, requestId })
    const report = await notifyManager(details, config, recipients)
    if (!report.transmitted) {
      // forgotten, so that the buyer's retry is sent again instead of taken for a duplicate
      await demoSink.release(request.idempotencyKey)
      console.error(
        "[submitBookingRequest] not transmitted",
        requestId,
        `e-mail: ${report.email}, WhatsApp: ${report.whatsapp}`,
      )
      return { ok: false, error: "server" }
    }

    // the summary leaves after the response: it never delays the request, nor fails it
    const acknowledged =
      config.resend !== null && summaryLimiter.check(request.email.toLowerCase()).allowed
    if (acknowledged) {
      after(async () => {
        const outcome = await acknowledgeBuyer(details, config, recipients.emails)
        if (outcome === "failed") {
          console.error("[submitBookingRequest] summary not sent", requestId)
        }
      })
    }
    return { ...accepted, acknowledged }
  } catch (error) {
    // Never log the request: it holds the buyer's name, phone and email.
    console.error("[submitBookingRequest] failed", describeError(error))
    return { ok: false, error: "server" }
  }
}

/** What the messages about a request say: the night, the table, the figures, the buyer. */
function requestDetails(
  content: VenueContent,
  table: TableContent,
  record: BookingRequestRecord,
): RequestDetails {
  const accent = getClub(content.club.slug)?.brand.accent
  const zone = content.zones.find((candidate) => candidate.id === table.zoneId)
  return {
    requestId: record.requestId,
    idempotencyKey: record.idempotencyKey,
    createdAt: record.createdAt,
    demo: content.club.demo,
    club: { slug: content.club.slug, name: content.club.name, contact: content.club.contact },
    accent: { color: accent?.color ?? "#18181b", on: accent?.on ?? "#ffffff" },
    event: { name: content.event.name, date: content.event.date },
    table: { label: table.label, zoneName: zone?.name ?? table.zoneId },
    partySize: record.partySize,
    arrivalTime: record.arrivalTime,
    buyer: {
      firstName: record.firstName,
      lastName: record.lastName,
      phone: record.phone,
      email: record.email,
      message: record.message,
    },
    quote: record.quote,
    attribution: record.attribution,
  }
}

async function clientIp(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for")
  return forwardedFor?.split(",")[0]?.trim() || "local"
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return `non-error thrown (${typeof error})`
  return error.stack ?? `${error.name}: ${error.message}`
}
