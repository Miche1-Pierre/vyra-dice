import type { ResendConfig } from "@/server/notify/config"

const RESEND_EMAILS = "https://api.resend.com/emails"

/** `already_sent`: the same message was sent before (same idempotency key). */
export type SendOutcome = "sent" | "already_sent" | "failed"

export interface Email {
  /** Name shown before the sending address: `VYRA`, `809 Social Club via VYRA`. */
  fromName: string
  to: string[]
  /** Where « Répondre » writes to. */
  replyTo?: string[]
  subject: string
  html: string
  text: string
  /** Shown in Resend's dashboard to tell e-mails apart (ASCII letters, digits, `_` and `-`). */
  tags?: Record<string, string>
}

export interface SendOptions {
  /** The same key within 24 hours: Resend sends the e-mail once. */
  idempotencyKey: string
  fetch?: typeof fetch
  timeoutMs?: number
}

/** `"809 Social Club via VYRA" <demandes@…>`: no quote or line break reaches the header. */
export function mailbox(name: string, address: string): string {
  return `"${name.replace(/["\\\r\n]/g, "").trim()}" <${address}>`
}

/**
 * Sends one e-mail with Resend. Never throws, and never logs the e-mail: it holds the buyer's name
 * and contact. Resend answers 409 to a key it has already seen: the e-mail went out before.
 */
export async function sendEmail(
  config: ResendConfig,
  email: Email,
  { idempotencyKey, fetch: fetchImpl = fetch, timeoutMs = 8000 }: SendOptions,
): Promise<SendOutcome> {
  try {
    const response = await fetchImpl(RESEND_EMAILS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: mailbox(email.fromName, config.from),
        to: email.to,
        ...(email.replyTo?.length ? { reply_to: email.replyTo } : {}),
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.tags
          ? { tags: Object.entries(email.tags).map(([name, value]) => ({ name, value })) }
          : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (response.ok) return "sent"
    if (response.status === 409) return "already_sent"
    console.error("[notify] e-mail refused by Resend:", response.status, await errorName(response))
    return "failed"
  } catch (error) {
    console.error("[notify] e-mail not sent:", error instanceof Error ? error.name : typeof error)
    return "failed"
  }
}

/** Resend's error code (`validation_error`…), never its message, which may quote an address. */
async function errorName(response: Response): Promise<string> {
  try {
    const name = ((await response.json()) as { name?: unknown } | null)?.name
    return typeof name === "string" ? name : "unknown"
  } catch {
    return "unknown"
  }
}
