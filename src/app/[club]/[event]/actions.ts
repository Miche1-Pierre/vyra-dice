"use server"

import { headers } from "next/headers"

import { getVenueContent } from "@/content/clubs"
import { createRequestId } from "@/lib/request-id"
import { bookingRequestInputSchema, toFieldErrors, type SubmitResult } from "@/lib/schema"
import { demoSink } from "@/server/requests/demo-sink"
import { createRateLimiter } from "@/server/requests/rate-limit"

/** 5 requests per 10 minutes per client IP and club, per server instance. */
const rateLimiter = createRateLimiter()

/**
 * Receives a table request from the venue page. A request is never a confirmed booking; in demo
 * mode it is acknowledged but transmitted nowhere.
 */
export async function submitBookingRequest(input: unknown): Promise<SubmitResult> {
  try {
    const parsed = bookingRequestInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: "validation", fieldErrors: toFieldErrors(parsed.error) }
    }
    const request = parsed.data

    const content = getVenueContent(request.clubSlug, request.eventSlug)
    const table = content?.tables.find((candidate) => candidate.id === request.tableId)
    if (!content || !table) return { ok: false, error: "unknown_table" }
    if (table.status === "sold") return { ok: false, error: "unavailable" }
    // Only the maximum is enforced: a smaller group may still take the table and its minimum spend.
    if (request.partySize > table.capacity.max) {
      return {
        ok: false,
        error: "validation",
        fieldErrors: { partySize: `Cette table accueille ${table.capacity.max} personnes maximum` },
      }
    }
    if (!content.club.demo) {
      // A live club needs a sink that actually reaches it. Until one exists, fail so the buyer gets
      // the fallback contact instead of an acknowledgement nobody will read.
      console.error("[submitBookingRequest] no request sink for live club", content.club.slug)
      return { ok: false, error: "server" }
    }

    const { allowed } = rateLimiter.check(`${content.club.slug}:${await clientIp()}`)
    if (!allowed) return { ok: false, error: "rate_limited" }

    const { requestId, duplicate } = await demoSink.save({
      ...request,
      requestId: createRequestId(content.club.requestPrefix),
      createdAt: new Date().toISOString(),
      status: "received",
      transmission: "not_sent_demo",
    })
    return { ok: true, requestId, demo: content.club.demo, duplicate }
  } catch (error) {
    // Never log the request: it holds the buyer's name, phone and email.
    console.error("[submitBookingRequest] failed", describeError(error))
    return { ok: false, error: "server" }
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
