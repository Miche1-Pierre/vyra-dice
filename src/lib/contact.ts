/**
 * Links that open a conversation in the person's own apps: the buyer writing to the club, or the
 * club's manager answering a buyer. Nothing is sent by these links: the person sends the message.
 */

/** Digits of an international number, as `wa.me` expects them: `+33 6 12 34 56 78` → `33612345678`. */
export function whatsappDigits(phone: string): string {
  return phone.replace(/\D/g, "")
}

/**
 * A number as a buyer typed it, in international form: `06 12 34 56 78` gives the digits
 * `33612345678` (for wa.me) and `+33 6 12 34 56 78` to show. A number without a country code is
 * taken as French, like the clubs; `null` when it cannot be a phone number.
 */
export function internationalPhone(phone: string): { digits: string; display: string } | null {
  const compact = phone.replace(/\(0\)/g, "").replace(/[^\d+]/g, "")
  let digits = compact
  if (compact.startsWith("+")) digits = compact.slice(1)
  else if (compact.startsWith("00")) digits = compact.slice(2)
  else if (/^0\d{9}$/.test(compact)) digits = `33${compact.slice(1)}`
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null
  const french = /^33\d{9}$/.test(digits)
  const display = french
    ? `+33 ${digits[2]} ${digits.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}`
    : `+${digits}`
  return { digits, display }
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
