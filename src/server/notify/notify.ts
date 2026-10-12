import type { NotifyConfig } from "@/server/notify/config"
import {
  buyerEmail,
  managerEmail,
  managerWhatsAppParameters,
  type RequestDetails,
} from "@/server/notify/messages"
import { sendEmail, type SendOutcome } from "@/server/notify/resend"
import { sendWhatsAppTemplate } from "@/server/notify/whatsapp"

// Server code only: sends requests with the team's keys. Never import it from a client component.

/** Who receives a request: the club's manager, or the team for a demo club. */
export interface Recipients {
  emails: string[]
  /** Digits with the country code. */
  whatsapp: string[]
}

/** `off`: the channel is not set up, or has nobody to write to. */
export type ChannelOutcome = SendOutcome | "off"

export interface ManagerReport {
  /** At least one channel reached the recipients. */
  transmitted: boolean
  email: ChannelOutcome
  whatsapp: ChannelOutcome
}

const reached = (outcome: ChannelOutcome) => outcome === "sent" || outcome === "already_sent"

/** Whether a request can be sent to these recipients at all. */
export function canNotify(config: NotifyConfig, to: Recipients): boolean {
  return (
    (config.resend !== null && to.emails.length > 0) ||
    (config.whatsapp !== null && to.whatsapp.length > 0)
  )
}

/**
 * Sends a request to its recipients, by e-mail and on WhatsApp at the same time. It is
 * transmitted when one channel reached them: the e-mail is the record, WhatsApp the alert on the
 * phone. Never throws.
 */
export async function notifyManager(
  d: RequestDetails,
  config: NotifyConfig,
  to: Recipients,
  { fetch: fetchImpl }: { fetch?: typeof fetch } = {},
): Promise<ManagerReport> {
  const email = async (): Promise<ChannelOutcome> => {
    if (!config.resend || to.emails.length === 0) return "off"
    return sendEmail(
      config.resend,
      {
        fromName: d.demo ? "VYRA (démo)" : "VYRA",
        to: to.emails,
        replyTo: [d.buyer.email],
        ...managerEmail(d),
        tags: { kind: "request", club: d.club.slug },
      },
      { idempotencyKey: `request/${d.idempotencyKey}/manager`, fetch: fetchImpl },
    )
  }
  const whatsapp = async (): Promise<ChannelOutcome> => {
    if (!config.whatsapp || to.whatsapp.length === 0) return "off"
    const parameters = managerWhatsAppParameters(d)
    const whatsappConfig = config.whatsapp
    const outcomes = await Promise.all(
      to.whatsapp.map((number) =>
        sendWhatsAppTemplate(whatsappConfig, number, parameters, { fetch: fetchImpl }),
      ),
    )
    return outcomes.some(reached) ? "sent" : "failed"
  }
  const [emailOutcome, whatsappOutcome] = await Promise.all([email(), whatsapp()])
  return {
    transmitted: reached(emailOutcome) || reached(whatsappOutcome),
    email: emailOutcome,
    whatsapp: whatsappOutcome,
  }
}

/**
 * Sends the buyer the summary of their request: from « <club> via VYRA », or from VYRA for a
 * demo club, which never writes in a club's name before its written agreement. « Répondre »
 * writes to `replyTo`: the manager, or the team for a demo. Never throws.
 */
export async function acknowledgeBuyer(
  d: RequestDetails,
  config: NotifyConfig,
  replyTo: string[],
  { fetch: fetchImpl }: { fetch?: typeof fetch } = {},
): Promise<ChannelOutcome> {
  if (!config.resend) return "off"
  return sendEmail(
    config.resend,
    {
      fromName: d.demo ? "VYRA (démo)" : `${d.club.name} via VYRA`,
      to: [d.buyer.email],
      replyTo,
      ...buyerEmail(d),
      tags: { kind: "summary", club: d.club.slug },
    },
    { idempotencyKey: `request/${d.idempotencyKey}/summary`, fetch: fetchImpl },
  )
}
