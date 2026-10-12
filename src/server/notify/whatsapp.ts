import type { WhatsAppConfig } from "@/server/notify/config"
import type { SendOutcome } from "@/server/notify/resend"

/**
 * Sends the approved template (`config.template`) to one WhatsApp number, given as digits with
 * the country code. Never throws, and never logs the variables: they hold the buyer's name and
 * contact. Meta does not deduplicate: the caller sends each request once.
 */
export async function sendWhatsAppTemplate(
  config: WhatsAppConfig,
  to: string,
  parameters: string[],
  { fetch: fetchImpl = fetch, timeoutMs = 8000 }: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<SendOutcome> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: config.template,
          language: { code: config.language },
          components: [
            { type: "body", parameters: parameters.map((text) => ({ type: "text", text })) },
          ],
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (response.ok) return "sent"
    console.error("[notify] WhatsApp message refused:", response.status, await errorCode(response))
    return "failed"
  } catch (error) {
    console.error(
      "[notify] WhatsApp message not sent:",
      error instanceof Error ? error.name : typeof error,
    )
    return "failed"
  }
}

/** Meta's error code and subcode (`131030`: number not allowed…), never its message. */
async function errorCode(response: Response): Promise<string> {
  try {
    const error = ((await response.json()) as { error?: Record<string, unknown> } | null)?.error
    const parts = [error?.code, error?.error_subcode].filter((part) => typeof part === "number")
    return parts.length > 0 ? parts.join("/") : "unknown"
  } catch {
    return "unknown"
  }
}
