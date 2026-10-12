import { internationalPhone, phoneUrl, whatsappUrl } from "@/lib/contact"
import { formatDateFr, formatEuro } from "@/lib/format"
import type { Attribution, Club } from "@/lib/schema"
import {
  button,
  details,
  emailDocument,
  escapeHtml,
  eyebrow,
  heading,
  link,
  multiline,
  note,
  paragraph,
  title,
} from "@/server/notify/html"

/** Everything the messages about one request say, gathered by the Server Action. */
export interface RequestDetails {
  requestId: string
  /** The form's key: the same request sent twice gives the same messages, sent once. */
  idempotencyKey: string
  /** Reception time, ISO 8601 (UTC). */
  createdAt: string
  /** Demo club: the request goes to the team, never to the club. */
  demo: boolean
  club: { slug: string; name: string; contact: Club["contact"] }
  /** The club's accent and the colour of text on it (`brand.json`). */
  accent: { color: string; on: string }
  event: { name: string; date: string }
  table: { label: string; zoneName: string }
  partySize: number
  arrivalTime: string
  buyer: { firstName: string; lastName: string; phone: string; email: string; message?: string }
  /** Figures shown to the buyer when the request was sent. */
  quote: { minimumSpend: number | null; deposit: number | null }
  attribution?: Attribution
}

export interface EmailContent {
  subject: string
  html: string
  text: string
}

const RECEIVED_AT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
})

/** One line: no line break, tab or run of spaces (subjects, WhatsApp variables). */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

const arrival = (time: string) => time.replace(":", "h")

const night = (d: RequestDetails) => `${d.event.name} · ${formatDateFr(d.event.date)}`

function minimum(d: RequestDetails): string {
  return d.quote.minimumSpend !== null
    ? `${formatEuro(d.quote.minimumSpend)} pour ${d.partySize} personnes`
    : "sur demande"
}

/** Rows of the request itself: night, table, group, arrival and the figures shown. */
function requestRows(d: RequestDetails): [string, string][] {
  const rows: [string, string][] = [
    ["Soirée", escapeHtml(night(d))],
    ["Table", escapeHtml(`${d.table.label} · ${d.table.zoneName}`)],
    ["Personnes", String(d.partySize)],
    ["Arrivée", arrival(d.arrivalTime)],
    ["Minimum", escapeHtml(minimum(d))],
  ]
  if (d.quote.deposit !== null) {
    rows.push(["Acompte", escapeHtml(`${formatEuro(d.quote.deposit)} si le club confirme`)])
  }
  return rows
}

/** Where the visitor came from (campaign parameters), when the link said it. */
function source(attribution?: Attribution): string | null {
  if (!attribution) return null
  const { utm_source, utm_medium, utm_campaign, utm_content, ref } = attribution
  const parts = [utm_source, utm_medium, utm_campaign, utm_content, ref].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : null
}

const NOT_A_BOOKING =
  "Ce n’est pas une réservation : confirmez ou refusez directement avec le client, dans vos outils habituels."

/**
 * The request as the manager reads it: who, which table, the figures shown, and links to answer
 * the buyer in one tap (WhatsApp, call, e-mail; « Répondre » writes to the buyer too).
 */
export function managerEmail(d: RequestDetails): EmailContent {
  const { buyer } = d
  const name = `${buyer.firstName} ${buyer.lastName}`
  const phone = internationalPhone(buyer.phone)
  const dial = phone ? `+${phone.digits}` : buyer.phone
  const answer = `Bonjour ${buyer.firstName}, ici ${d.club.name}, au sujet de votre demande ${d.requestId} pour la table ${d.table.label} (${d.event.name}).`
  const whatsapp = phone ? whatsappUrl(dial, answer) : null
  const mailto = `mailto:${buyer.email}?subject=${encodeURIComponent(`Votre demande ${d.requestId} · ${d.club.name}`)}`
  const received = `Reçue le ${RECEIVED_AT.format(new Date(d.createdAt))} (heure de Paris)`
  const from = source(d.attribution)
  const demo = d.demo
    ? `Démo : cette demande vient de la démo ${d.club.name}. Elle n’a pas été transmise au club.`
    : null

  const subject = oneLine(
    `${d.demo ? "[Démo] " : ""}Nouvelle demande · Table ${d.table.label} · ${d.event.name} · ${d.partySize} pers. · ${d.requestId}`,
  )
  const body = [
    eyebrow(`${escapeHtml(d.club.name)} · Nouvelle demande${d.demo ? " · Démo" : ""}`),
    title(escapeHtml(`Table ${d.table.label} · ${d.table.zoneName}`)),
    paragraph(
      escapeHtml(`${night(d)} · ${d.partySize} personnes · arrivée ${arrival(d.arrivalTime)}`),
      { muted: true },
    ),
    heading("Client"),
    details([
      ["Nom", escapeHtml(name)],
      ["Téléphone", link(phoneUrl(dial), phone?.display ?? buyer.phone)],
      ["E-mail", link(mailto, buyer.email)],
      ...(buyer.message ? [["Message", multiline(buyer.message)] as [string, string]] : []),
    ]),
    whatsapp ? button(whatsapp, "Répondre sur WhatsApp", d.accent.color, d.accent.on) : "",
    button(phoneUrl(dial), "Appeler", d.accent.color, d.accent.on),
    heading("La demande"),
    details(requestRows(d)),
    note(escapeHtml(NOT_A_BOOKING), { strong: true }),
    paragraph(
      escapeHtml(
        [`Référence ${d.requestId}`, received, from && `source : ${from}`]
          .filter(Boolean)
          .join(" · "),
      ),
      {
        muted: true,
        small: true,
      },
    ),
    demo ? paragraph(escapeHtml(demo), { muted: true, small: true }) : "",
  ].join("\n")

  const text = [
    `Nouvelle demande de table · ${d.club.name}${d.demo ? " (démo)" : ""}`,
    `Référence : ${d.requestId}`,
    "",
    `Soirée : ${night(d)}`,
    `Table : ${d.table.label} · ${d.table.zoneName}`,
    `Personnes : ${d.partySize}`,
    `Arrivée : ${arrival(d.arrivalTime)}`,
    `Minimum : ${minimum(d)}`,
    ...(d.quote.deposit !== null
      ? [`Acompte : ${formatEuro(d.quote.deposit)} si le club confirme`]
      : []),
    "",
    `Client : ${name}`,
    `Téléphone : ${phone?.display ?? buyer.phone}`,
    `E-mail : ${buyer.email}`,
    ...(buyer.message ? [`Message : ${buyer.message}`] : []),
    "",
    ...(whatsapp ? [`Répondre sur WhatsApp : ${whatsapp}`, ""] : []),
    NOT_A_BOOKING,
    [received, from && `source : ${from}`].filter(Boolean).join(" · "),
    ...(demo ? [demo] : []),
  ].join("\n")

  return {
    subject,
    html: emailDocument({
      title: subject,
      preheader: `${name} · ${phone?.display ?? buyer.phone}`,
      accent: d.accent.color,
      body,
    }),
    text,
  }
}

/**
 * A variable of a WhatsApp template: one line (WhatsApp refuses line breaks, tabs and runs of
 * spaces in them), cut at `max` characters, never empty.
 */
export function templateParameter(value: string, max: number): string {
  const line = oneLine(value)
  const cut = line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line
  return cut || "—"
}

/**
 * The variables of the manager's WhatsApp template, in order (text of the template in
 * `docs/notifications.md`): reference, night, table and figures, name, contact, message.
 */
export function managerWhatsAppParameters(d: RequestDetails): string[] {
  const { buyer } = d
  const phone = internationalPhone(buyer.phone)
  const price =
    d.quote.minimumSpend !== null
      ? `minimum ${formatEuro(d.quote.minimumSpend)}`
      : "prix sur demande"
  const deposit = d.quote.deposit !== null ? ` · acompte ${formatEuro(d.quote.deposit)}` : ""
  return [
    `${d.requestId}${d.demo ? " (démo)" : ""}`,
    `${d.event.name} du ${formatDateFr(d.event.date)} au ${d.club.name}`,
    `${d.table.label} (${d.table.zoneName}) · ${d.partySize} pers. · arrivée ${arrival(d.arrivalTime)} · ${price}${deposit}`,
    `${buyer.firstName} ${buyer.lastName}`,
    `${phone?.display ?? buyer.phone} · ${buyer.email}`,
    // the message's lines, kept apart on its one line
    buyer.message?.replace(/\s*\n\s*/g, " / ") ?? "aucun",
  ].map((value, index) => templateParameter(value, index === 5 ? 300 : 160))
}
