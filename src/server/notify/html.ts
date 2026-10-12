/*
 * Building blocks of the e-mails: tables and inline styles, which every mail client renders, and
 * every value escaped. Light colours only: clients that darken e-mails do it on their own.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/** Text or attribute value for HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)
}

/** Lines typed by a person: escaped, line breaks kept. */
export function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>")
}

const INK = "#18181b"
const MUTED = "#71717a"
const LINE = "#e4e4e7"
const PAGE = "#f4f4f5"
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** A club's accent (`brand.json`) or the neutral ink: never anything else in a style attribute. */
export function safeColor(color: string | undefined, fallback = INK): string {
  return color && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) ? color : fallback
}

/** The whole e-mail: a card on a grey page, under a band of the accent colour. */
export function emailDocument({
  title,
  preheader,
  accent,
  body,
}: {
  title: string
  /** Line shown after the subject in the inbox list. */
  preheader: string
  accent: string
  body: string
}): string {
  return [
    "<!doctype html>",
    '<html lang="fr">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title></head>`,
    `<body style="margin:0;padding:0;background:${PAGE};">`,
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">`,
    '<tr><td align="center" style="padding:24px 12px;">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;font-family:${FONT};color:${INK};">`,
    `<tr><td style="height:4px;background:${safeColor(accent)};border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>`,
    `<tr><td style="padding:24px 24px 28px;font-size:15px;line-height:1.5;">${body}</td></tr>`,
    "</table>",
    "</td></tr></table>",
    "</body></html>",
  ].join("\n")
}

/** Small capitals above a title. */
export function eyebrow(html: string, color = MUTED): string {
  return `<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${safeColor(color, MUTED)};">${html}</p>`
}

export function title(html: string): string {
  return `<h1 style="margin:0 0 4px;font-size:22px;line-height:1.3;font-weight:700;">${html}</h1>`
}

export function heading(html: string): string {
  return `<h2 style="margin:24px 0 8px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">${html}</h2>`
}

export function paragraph(html: string, { muted = false, small = false } = {}): string {
  const color = muted ? MUTED : INK
  const size = small ? "13px" : "15px"
  return `<p style="margin:12px 0 0;font-size:${size};color:${color};">${html}</p>`
}

/** Label / value rows; values are HTML (escaped by the caller). */
export function details(rows: [label: string, valueHtml: string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid ${LINE};color:${MUTED};font-size:14px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
        `<td style="padding:8px 0;border-top:1px solid ${LINE};font-size:15px;vertical-align:top;">${value}</td></tr>`,
    )
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cells}</table>`
}

/** A link styled as a button, in the accent colour. */
export function button(href: string, label: string, accent: string, on: string): string {
  return (
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:12px 8px 0 0;padding:11px 16px;border-radius:8px;` +
    `background:${safeColor(accent)};color:${safeColor(on, "#ffffff")};font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>`
  )
}

/** A link inside text. */
export function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${INK};">${escapeHtml(label)}</a>`
}

/** A framed note: the demo warning (`first`: at the top of the e-mail), the « not a booking » reminder. */
export function note(html: string, { strong = false, first = false } = {}): string {
  const weight = strong ? "font-weight:600;" : ""
  const margin = first ? "0 0 20px" : "20px 0 0"
  return `<p style="margin:${margin};padding:12px 14px;border-radius:8px;background:${PAGE};font-size:14px;${weight}">${html}</p>`
}
