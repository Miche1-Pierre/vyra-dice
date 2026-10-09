/**
 * Links that open a conversation with the club in its own apps. Nothing is sent by us: the buyer
 * sends the message, and the club answers as usual.
 */

/** Digits of an international number, as `wa.me` expects them: `+33 6 12 34 56 78` → `33612345678`. */
export function whatsappDigits(phone: string): string {
  return phone.replace(/\D/g, "")
}

/** Opens WhatsApp on the club's number, with an optional message already written. */
export function whatsappUrl(phone: string, text?: string): string {
  const base = `https://wa.me/${whatsappDigits(phone)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** Opens the Instagram conversation with the club (no message can be prefilled). */
export function instagramUrl(handle: string): string {
  return `https://ig.me/m/${handle}`
}

/** Name of a ticketing site for its link: "Shotgun", or the host name. */
export function ticketingSite(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "")
  return host.includes("shotgun") ? "Shotgun" : host
}

/** `tel:` link of a phone number as typed by the club. */
export function phoneUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}

/** First message to the club, with the night and the table the buyer is looking at. */
export function contactMessage({
  clubName,
  eventName,
  tableLabel,
}: {
  clubName: string
  eventName: string
  tableLabel?: string
}): string {
  const about = tableLabel ? `la table ${tableLabel}` : "vos tables"
  return `Bonjour ${clubName}, je regarde la soirée « ${eventName} » et j’ai une question sur ${about}.`
}
