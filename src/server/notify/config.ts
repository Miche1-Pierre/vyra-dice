// Server code only: reads secrets from the environment. Never import it from a client component.

/** Resend, which sends the e-mails: to the manager, and the summary to the buyer. */
export interface ResendConfig {
  apiKey: string
  /** Sending address on the team's verified domain, without a display name. */
  from: string
}

/** WhatsApp Cloud API (Meta): one approved template message per request to the manager. */
export interface WhatsAppConfig {
  token: string
  phoneNumberId: string
  template: string
  language: string
  apiVersion: string
}

export interface NotifyConfig {
  resend: ResendConfig | null
  whatsapp: WhatsAppConfig | null
  /** Who receives the requests of demo clubs: the team, never a club. */
  team: { emails: string[]; whatsapp: string[] }
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

/** `VYRA <demandes@exemple.fr>` or `demandes@exemple.fr` → `demandes@exemple.fr`. */
function address(value: string): string | null {
  const bare = /<([^>]+)>\s*$/.exec(value)?.[1] ?? value
  const trimmed = bare.trim()
  return EMAIL.test(trimmed) ? trimmed : null
}

/** Comma- or semicolon-separated list (a phone number keeps its spaces). */
function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * What the environment sets up for sending requests (`.env.example`). A channel without all its
 * settings is off, and a request nobody can be sent to stays a demo acknowledgement.
 */
export function readNotifyConfig(
  env: Record<string, string | undefined> = process.env,
): NotifyConfig {
  const apiKey = env.RESEND_API_KEY?.trim()
  const from = address(env.REQUESTS_FROM_EMAIL ?? "")
  const token = env.WHATSAPP_TOKEN?.trim()
  // both go into the API's URL: digits, and a version like v23.0
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  const apiVersion = env.WHATSAPP_API_VERSION?.trim()
  return {
    resend: apiKey && from ? { apiKey, from } : null,
    whatsapp:
      token && phoneNumberId && /^\d+$/.test(phoneNumberId)
        ? {
            token,
            phoneNumberId,
            template: env.WHATSAPP_TEMPLATE?.trim() || "nouvelle_demande_table",
            language: env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "fr",
            apiVersion: apiVersion && /^v\d+\.\d+$/.test(apiVersion) ? apiVersion : "v23.0",
          }
        : null,
    team: {
      emails: list(env.REQUESTS_TEAM_EMAIL)
        .map(address)
        .filter((email): email is string => email !== null),
      whatsapp: list(env.REQUESTS_TEAM_WHATSAPP)
        .map((phone) => phone.replace(/\D/g, ""))
        .filter((digits) => /^[1-9]\d{7,14}$/.test(digits)),
    },
  }
}
